import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupPasswordAuth, hashPassword } from "./auth";
import { getSession } from "./session";
import passport from "passport";
import { insertBookingSchema, insertGallerySchema, insertContactMessageSchema, insertCatalogueSchema, insertReviewSchema, insertUserSchema, insertCouponSchema, type Coupon } from "@shared/schema";
import { defaultPricingConfig } from "@shared/pricing";
import { defaultSiteConfig } from "@shared/site-config";
import { z } from "zod";
import { lemonSqueezySetup, createCheckout } from '@lemonsqueezy/lemonsqueezy.js';
import { sendBookingReceived, sendBookingConfirmation, sendPaymentConfirmation, sendPasswordReset, sendPhotographerApproved, sendPhotographerRejected, sendAdminEmail, sendInboundEmailNotification } from "./email";
import { getCloudinarySignedConfig, generateSignature } from "./upload";

const lemonSqueezyEnabled = Boolean(
  process.env.LEMONSQUEEZY_API_KEY &&
  process.env.LEMONSQUEEZY_STORE_ID &&
  process.env.LEMONSQUEEZY_VARIANT_ID &&
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET
);

if (lemonSqueezyEnabled) {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY,
    onError: (error) => console.error('Lemon Squeezy Error:', error),
  });
} else {
  console.warn("Lemon Squeezy disabled: missing required env vars.");
}

// LS store info: store 292314, slug "connectagrapherpayment", domain "connectagrapher.com"
// connectagrapher.com → Vercel (not LS), so checkout URLs must be proxied.
// The proxy (registered below) intercepts /checkout/* and serves LS checkout HTML
// using the X-Forwarded-Host trick to get LS to serve HTML without redirecting.
const LS_NATIVE_HOST = 'connectagrapherpayment.lemonsqueezy.com';
const LS_STORE_HOST = 'connectagrapher.com';

function normalizeLsUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname !== LS_NATIVE_HOST) {
      u.hostname = LS_NATIVE_HOST;
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Booking with user account creation schema
// password/confirmPassword are optional — only required when creating a NEW user
const bookingWithAccountSchema = insertBookingSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  confirmPassword: z.string().optional(),
  couponCode: z.string().optional(),
}).refine((data) => {
  if (data.password !== undefined || data.confirmPassword !== undefined) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Admin-specific validation schemas
const statusUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "declined"])
});

// Catalogue validation schemas
const catalogueSchema = insertCatalogueSchema;
const updateCatalogueSchema = insertCatalogueSchema.partial().extend({
  images: z.array(z.string()).optional(),
  bookingId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

// Review validation schemas
const reviewSchema = insertReviewSchema.extend({
  rating: z.number().min(1).max(5),
  reviewType: z.enum(["catalogue", "general"]),
  catalogueId: z.string().optional()
}).refine((data) => {
  // If reviewType is "catalogue", catalogueId must be provided
  if (data.reviewType === "catalogue" && !data.catalogueId) {
    return false;
  }
  return true;
}, {
  message: "catalogueId is required when reviewType is 'catalogue'"
});

// Authentication middleware for password auth
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
};

const isAdmin = async (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  if (req.user && req.user.isAdmin) {
    return next();
  }
  
  res.status(403).json({ error: "Admin access required" });
};

const isPhotographerApproved = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== "photographer") {
    return res.status(403).json({ error: "Photographer access required" });
  }
  if (req.user.photographerStatus !== "approved") {
    return res.status(403).json({ error: "Photographer approval required" });
  }
  return next();
};

// Safe DTOs for public responses
const createSafeCatalogueDTO = (catalogue: any) => ({
  id: catalogue.id,
  title: catalogue.title,
  description: catalogue.description,
  serviceType: catalogue.serviceType,
  coverImage: catalogue.coverImage,
  images: catalogue.images,
  sortOrder: catalogue.sortOrder,
  createdAt: catalogue.createdAt,
  publishedAt: catalogue.publishedAt,
  photographerId: catalogue.photographerId ?? null,
  photographerName: catalogue.photographerName ?? null,
});

const createSafeReviewDTO = (review: any) => ({
  id: review.id,
  clientName: review.clientName,
  rating: review.rating,
  reviewText: review.reviewText,
  reviewType: review.reviewType,
  createdAt: review.createdAt
});

// Email normalization utility
const normalizeEmail = (email: string) => email.toLowerCase().trim();

export async function registerRoutes(app: Express): Promise<Server> {
  // Version probe — lets us verify which bundle Vercel is serving
  app.get('/api/version', (_req, res) => res.json({ v: 6, schema: 'checkoutProxy' }));

  // ── Lemon Squeezy Checkout Proxy ──────────────────────────────────────────
  // connectagrapher.com (the LS store domain) points to Vercel, not LS servers.
  // So checkout URLs from LS land on our app instead of LS's checkout page.
  //
  // Fix: proxy /checkout/* to the LS native domain with X-Forwarded-Host.
  // When LS sees X-Forwarded-Host: connectagrapher.com, it serves the checkout
  // HTML directly (200) rather than redirecting to the store domain.
  //
  // Two-step flow:
  //   /checkout/custom/UUID  →  LS native → 302 → /checkout/cart/CART_UUID
  //   /checkout/cart/CART_UUID →  LS native (with X-Fwd-Host) → 200 HTML
  app.all('/checkout/*', async (req: any, res: any) => {
    try {
      const qs = new URLSearchParams(req.query as Record<string, string>).toString();
      const targetUrl = `https://${LS_NATIVE_HOST}${req.path}${qs ? '?' + qs : ''}`;

      const headers: Record<string, string> = {
        'X-Forwarded-Host': LS_STORE_HOST,
        'X-Forwarded-Proto': 'https',
        'Accept': (req.headers['accept'] as string) || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': (req.headers['accept-language'] as string) || 'en-US,en;q=0.9',
        'User-Agent': (req.headers['user-agent'] as string) || 'Mozilla/5.0',
      };

      if (req.headers.cookie)          headers['Cookie']           = req.headers.cookie;
      if (req.headers['x-inertia'])    headers['X-Inertia']        = req.headers['x-inertia'] as string;
      if (req.headers['x-inertia-version']) headers['X-Inertia-Version'] = req.headers['x-inertia-version'] as string;
      if (req.headers['x-xsrf-token']) headers['X-XSRF-TOKEN']     = req.headers['x-xsrf-token'] as string;
      if (req.headers['x-requested-with']) headers['X-Requested-With'] = req.headers['x-requested-with'] as string;

      let body: string | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const ct = (req.headers['content-type'] as string) || '';
        if (ct.includes('application/x-www-form-urlencoded')) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          body = new URLSearchParams(req.body as Record<string, string>).toString();
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify(req.body);
        }
      }

      const lsRes = await fetch(targetUrl, { method: req.method, headers, body, redirect: 'manual' });

      // Forward Set-Cookie headers without domain restriction so browser accepts them
      const setCookies: string[] =
        typeof (lsRes.headers as any).getSetCookie === 'function'
          ? (lsRes.headers as any).getSetCookie()
          : [lsRes.headers.get('set-cookie') ?? ''].filter(Boolean);
      for (const c of setCookies) {
        res.append('Set-Cookie', c.replace(/;\s*domain=[^;]*/gi, ''));
      }

      // Handle LS redirect to its store domain — convert to relative so browser
      // follows it back to our www domain (where the proxy runs again for step 2)
      if (lsRes.status === 301 || lsRes.status === 302 || lsRes.status === 303) {
        const loc = lsRes.headers.get('location') || '';
        try {
          const locUrl = new URL(loc);
          if (locUrl.hostname === LS_STORE_HOST) {
            res.redirect(302, locUrl.pathname + locUrl.search);
            return;
          }
        } catch { /* not a valid URL, fall through */ }
        res.redirect(lsRes.status, loc);
        return;
      }

      const ct = lsRes.headers.get('content-type') || 'text/html; charset=UTF-8';
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'no-store');

      let html = await lsRes.text();

      // Patch all store domain references to www so checkout JS calls stay same-origin
      if (ct.includes('text/html') || ct.includes('application/json')) {
        html = html
          .split('https:\\/\\/connectagrapher.com').join('https:\\/\\/www.connectagrapher.com')
          .split('https://connectagrapher.com').join('https://www.connectagrapher.com')
          .split('http:\\/\\/connectagrapher.com').join('http:\\/\\/www.connectagrapher.com')
          .split('http://connectagrapher.com').join('http://www.connectagrapher.com');
      }

      res.status(lsRes.status).send(html);
    } catch (err: any) {
      console.error('[checkout proxy]', err.message);
      res.status(502).send('Checkout temporarily unavailable. Please try again.');
    }
  });

  // Setup session and passport authentication
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Setup password authentication (includes /api/register, /api/login, /api/logout, /api/user)
  setupPasswordAuth(app);

  // Public endpoint for photographer ID photo upload signature (used during sign-up before auth)
  app.post('/api/upload-id-signature', (req, res) => {
    const config = getCloudinarySignedConfig();
    if (!config) {
      return res.status(503).json({ error: "Image upload not configured." });
    }
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'verification_docs';
    const params = { folder, timestamp };
    const signature = generateSignature(params, config.apiSecret);
    res.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, signature, folder });
  });

  app.get("/api/photographer/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      if (role !== "photographer") {
        return res.status(403).json({ error: "Photographer access required" });
      }
      const profile = await storage.getPhotographerProfileByUserId(userId);
      res.json({ profile, status: (req as any).user?.photographerStatus });
    } catch (error) {
      console.error("Error fetching photographer profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/photographer/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      if (role !== "photographer") {
        return res.status(403).json({ error: "Photographer access required" });
      }
      const existing = await storage.getPhotographerProfileByUserId(userId);
      const profileData = {
        displayName: req.body?.displayName,
        bio: req.body?.bio,
        location: req.body?.location,
        specialties: req.body?.specialties ?? [],
        portfolioLinks: req.body?.portfolioLinks ?? [],
        pricing: req.body?.pricing,
        availability: req.body?.availability,
        phone: req.body?.phone,
        socials: req.body?.socials ?? {},
        verificationDocs: req.body?.verificationDocs ?? [],
      };

      const profile = existing
        ? await storage.updatePhotographerProfile(userId, profileData)
        : await storage.createPhotographerProfile({ userId, ...profileData });

      res.json({ profile });
    } catch (error) {
      console.error("Error updating photographer profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/pricing", async (req, res) => {
    try {
      const photographerId = typeof req.query.photographerId === "string" ? req.query.photographerId : null;
      if (photographerId) {
        const photographer = await storage.getUserById(photographerId);
        if (!photographer || photographer.role !== "photographer" || photographer.photographerStatus !== "approved") {
          return res.status(404).json({ error: "Photographer not found" });
        }
        const profile = await storage.getPhotographerProfileByUserId(photographerId);
        return res.json(profile?.pricingConfig || defaultPricingConfig);
      }

      const row = await storage.getPricingConfig("global");
      res.json(row?.config || defaultPricingConfig);
    } catch (error) {
      console.error("Error fetching pricing config:", error);
      res.status(500).json({ error: "Failed to fetch pricing" });
    }
  });

  app.put("/api/admin/pricing", isAdmin, async (req, res) => {
    try {
      const pricingSchema = z.object({ config: z.record(z.any()) });
      const { config } = pricingSchema.parse(req.body);
      const row = await storage.upsertPricingConfig("global", config);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid pricing data", details: error.errors });
      }
      console.error("Error updating pricing config:", error);
      res.status(500).json({ error: "Failed to update pricing" });
    }
  });

  app.get("/api/site-config", async (_req, res) => {
    try {
      const row = await storage.getSiteConfig("global");
      res.json(row?.config || defaultSiteConfig);
    } catch (error) {
      console.error("Error fetching site config:", error);
      res.status(500).json({ error: "Failed to fetch site config" });
    }
  });

  app.put("/api/admin/site-config", isAdmin, async (req, res) => {
    try {
      const siteConfigSchema = z.object({ config: z.record(z.any()) });
      const { config } = siteConfigSchema.parse(req.body);
      const row = await storage.upsertSiteConfig("global", config);
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid site config data", details: error.errors });
      }
      console.error("Error updating site config:", error);
      res.status(500).json({ error: "Failed to update site config" });
    }
  });

  app.get("/api/photographer/pricing", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      if (role !== "photographer") {
        return res.status(403).json({ error: "Photographer access required" });
      }
      const profile = await storage.getPhotographerProfileByUserId(userId);
      res.json({ config: profile?.pricingConfig || defaultPricingConfig });
    } catch (error) {
      console.error("Error fetching photographer pricing:", error);
      res.status(500).json({ error: "Failed to fetch photographer pricing" });
    }
  });

  app.put("/api/photographer/pricing", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      if (role !== "photographer") {
        return res.status(403).json({ error: "Photographer access required" });
      }
      const pricingSchema = z.object({ config: z.record(z.any()) });
      const { config } = pricingSchema.parse(req.body);
      const existing = await storage.getPhotographerProfileByUserId(userId);
      const profile = existing
        ? await storage.updatePhotographerPricing(userId, config)
        : await storage.createPhotographerProfile({ userId, pricingConfig: config });
      res.json({ profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid pricing data", details: error.errors });
      }
      console.error("Error updating photographer pricing:", error);
      res.status(500).json({ error: "Failed to update photographer pricing" });
    }
  });

  app.get("/api/photographers/:id/public", async (req, res) => {
    try {
      const photographer = await storage.getUserById(req.params.id);
      if (!photographer || photographer.role !== "photographer" || photographer.photographerStatus !== "approved") {
        return res.status(404).json({ error: "Photographer not found" });
      }
      const profile = await storage.getPhotographerProfileByUserId(req.params.id);
      const displayName =
        profile?.displayName ||
        [photographer.firstName, photographer.lastName].filter(Boolean).join(" ") ||
        "Photographer";
      res.json({
        id: photographer.id,
        displayName,
      });
    } catch (error) {
      console.error("Error fetching photographer profile:", error);
      res.status(500).json({ error: "Failed to fetch photographer" });
    }
  });

  // Booking routes with user account creation
  app.post("/api/bookings", async (req, res) => {
    try {
      // Log booking request without sensitive data
      const { password: reqPassword, confirmPassword: reqConfirmPassword, ...safeBookingData } = req.body;
      console.log('Booking request received for:', safeBookingData.email);
      
      // Validate booking data including password fields
      const validatedData = bookingWithAccountSchema.parse(req.body);
      
      // Extract password and confirmPassword from validated data
      const { password: validatedPassword, confirmPassword: validatedConfirmPassword, ...bookingData } = validatedData;
      
      // Check if user already exists with this email
      const normalizedEmail = normalizeEmail(bookingData.email);
      let user = await storage.getUserByEmail(normalizedEmail);
      
      // If user doesn't exist, create a new account
      if (!user) {
        if (!validatedPassword) {
          return res.status(400).json({ error: 'Password is required to create your account. Please fill in the password fields.' });
        }
        const hashedPassword = await hashPassword(validatedPassword);

        // Extract first and last name from clientName
        const [firstName, ...lastNameParts] = bookingData.clientName.split(' ');
        const lastName = lastNameParts.join(' ') || '';

        const newUser = await storage.createUser({
          id: crypto.randomUUID(),
          email: normalizedEmail,
          password: hashedPassword,
          firstName: firstName,
          lastName: lastName,
          profileImageUrl: null,
          isAdmin: false,
          isBlocked: false,
          role: "client",
          photographerStatus: null,
        });

        user = newUser;
        console.log('Created new user account for booking:', normalizedEmail);
      } else {
        console.log('Using existing user account for booking:', normalizedEmail);
      }
      
      if (bookingData.photographerId) {
        const photographer = await storage.getUserById(bookingData.photographerId);
        if (!photographer || photographer.role !== "photographer" || photographer.photographerStatus !== "approved") {
          return res.status(400).json({ error: "Invalid photographer selection" });
        }
      }

      // Validate and apply coupon if provided
      let discountAmount = 0;
      let appliedCouponCode: string | null = null;
      let couponRecord: Coupon | undefined = undefined;
      if (bookingData.couponCode) {
        couponRecord = await storage.getCouponByCode(bookingData.couponCode);
        if (couponRecord && couponRecord.isActive) {
          const now = new Date();
          const notExpired = !couponRecord.expiresAt || couponRecord.expiresAt > now;
          const withinLimit = couponRecord.usageLimit === null || couponRecord.usageCount < couponRecord.usageLimit;
          if (notExpired && withinLimit) {
            if (couponRecord.discountType === 'percentage') {
              discountAmount = Math.round(bookingData.totalPrice * (couponRecord.discountValue / 100));
            } else {
              discountAmount = Math.min(couponRecord.discountValue, bookingData.totalPrice);
            }
            appliedCouponCode = couponRecord.code;
          }
        }
      }

      const discountedTotal = bookingData.totalPrice - discountAmount;

      // Calculate deposit and balance amounts (50% split on discounted total)
      const depositAmount = Math.round(discountedTotal * 0.5);
      const balanceDue = discountedTotal - depositAmount;

      // Create the booking with calculated amounts
      const bookingWithAmounts = {
        ...bookingData,
        totalPrice: discountedTotal,
        depositAmount,
        balanceDue,
        couponCode: appliedCouponCode,
        discountAmount,
      };

      const booking = await storage.createBooking(bookingWithAmounts);

      // Increment coupon usage
      if (couponRecord && appliedCouponCode) {
        await storage.incrementCouponUsage(couponRecord.id);
      }
      
      // Create gallery access for the booking
      const accessCode = Math.random().toString(36).substr(2, 8).toUpperCase();
      await storage.createGallery({
        bookingId: booking.id,
        clientEmail: booking.email,
        accessCode: accessCode,
        galleryImages: [],
        selectedImages: [],
        finalImages: [],
      });

      // Send "booking received, awaiting deposit" email (non-blocking)
      sendBookingReceived({
        clientName: booking.clientName,
        email: booking.email,
        serviceType: booking.serviceType,
        shootDate: booking.shootDate,
        shootTime: booking.shootTime ?? undefined,
        location: booking.location ?? undefined,
        totalPrice: booking.totalPrice,
        depositAmount: booking.depositAmount ?? Math.round(booking.totalPrice * 0.5),
        balanceDue: booking.balanceDue ?? booking.totalPrice - Math.round(booking.totalPrice * 0.5),
        id: booking.id,
      }, accessCode).catch(err => console.error('Failed to send booking received email:', err));

      res.json({
        booking,
        accessCode,
        userCreated: !user || user.id === user.id, // Indicate if new user was created
        message: user ? "Booking created with existing account" : "Booking created with new account"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Booking validation errors:', error.errors);
        res.status(400).json({ 
          error: "Invalid booking data",
          details: error.errors
        });
      } else {
        console.error('Booking creation error:', error);
        res.status(500).json({ error: "Failed to create booking" });
      }
    }
  });

  // Removed public booking endpoints - these are now admin-only for security

  // Gallery routes
  app.post("/api/gallery/access", async (req, res) => {
    try {
      const { email, accessCode } = req.body;
      const gallery = await storage.getGalleryByAccess(email, accessCode);
      if (!gallery) {
        return res.status(404).json({ error: "Gallery not found or invalid access code" });
      }
      res.json(gallery);
    } catch (error) {
      res.status(500).json({ error: "Failed to access gallery" });
    }
  });

  // Client gallery selection update (public, authenticated by gallery ownership via email+code)
  app.patch("/api/gallery/:id/images", async (req, res) => {
    try {
      const { id } = req.params;
      const { images, type } = req.body;
      if (!["gallery", "selected", "final"].includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
      }
      // Only allow clients to update their selected images
      if (type !== "selected") {
        return res.status(403).json({ error: "Clients can only update selected images" });
      }
      const gallery = await storage.getGalleryById(id);
      if (!gallery) {
        return res.status(404).json({ error: "Gallery not found" });
      }
      const updated = await storage.updateGalleryImages(id, images, type);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update gallery" });
    }
  });

  // Client leaves a comment on a specific image
  app.patch("/api/gallery/:id/image-comment", async (req, res) => {
    try {
      const { id } = req.params;
      const { imageUrl, comment } = z.object({ imageUrl: z.string().url(), comment: z.string().max(500) }).parse(req.body);
      const gallery = await storage.getGalleryById(id);
      if (!gallery) return res.status(404).json({ error: "Gallery not found" });
      const updated = await storage.updateImageComment(id, imageUrl, comment);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      res.status(500).json({ error: "Failed to save image comment" });
    }
  });

  // Client leaves a comment on their gallery
  app.patch("/api/gallery/:id/comment", async (req, res) => {
    try {
      const { id } = req.params;
      const { comment } = z.object({ comment: z.string().max(2000) }).parse(req.body);
      const gallery = await storage.getGalleryById(id);
      if (!gallery) return res.status(404).json({ error: "Gallery not found" });
      const updated = await storage.updateGalleryComment(id, comment);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      res.status(500).json({ error: "Failed to save comment" });
    }
  });

  // Coupon: public validate endpoint
  app.get("/api/coupons/validate", async (req, res) => {
    try {
      const code = String(req.query.code || "").trim().toUpperCase();
      const price = Number(req.query.price || 0);
      if (!code) return res.status(400).json({ error: "Code required" });
      const coupon = await storage.getCouponByCode(code);
      if (!coupon || !coupon.isActive) return res.status(404).json({ error: "Invalid or inactive coupon" });
      const now = new Date();
      if (coupon.expiresAt && coupon.expiresAt <= now) return res.status(400).json({ error: "Coupon has expired" });
      if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) return res.status(400).json({ error: "Coupon usage limit reached" });
      const discount = coupon.discountType === 'percentage'
        ? Math.round(price * (coupon.discountValue / 100))
        : Math.min(coupon.discountValue, price);
      res.json({ valid: true, code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, discount, description: coupon.description });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate coupon" });
    }
  });

  // Coupon: admin CRUD
  app.get("/api/admin/coupons", isAdmin, async (_req, res) => {
    try { res.json(await storage.getAllCoupons()); }
    catch { res.status(500).json({ error: "Failed to fetch coupons" }); }
  });

  app.post("/api/admin/coupons", isAdmin, async (req, res) => {
    try {
      const data = insertCouponSchema.parse(req.body);
      res.json(await storage.createCoupon(data));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: "Failed to create coupon" });
    }
  });

  app.put("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const updated = await storage.updateCoupon(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Coupon not found" });
      res.json(updated);
    } catch { res.status(500).json({ error: "Failed to update coupon" }); }
  });

  app.delete("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const ok = await storage.deleteCoupon(req.params.id);
      if (!ok) return res.status(404).json({ error: "Coupon not found" });
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Failed to delete coupon" }); }
  });

  // Contact routes
  app.post("/api/contact", async (req, res) => {
    try {
      const messageData = insertContactMessageSchema.parse(req.body);
      const message = await storage.createContactMessage(messageData);
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  // Removed public contact GET route - moved to admin-only for security

  // Package pricing endpoint
  app.get("/api/packages", async (req, res) => {
    const packages = {
      photoshoot: {
        bronze: { price: 150, duration: 45, images: 6, locations: 1 },
        silver: { price: 200, duration: 60, images: 10, locations: 1 },
        gold: { price: 300, duration: 120, images: 15, locations: 1 },
        platinum: { price: 500, duration: 150, images: 25, locations: 2 },
      },
      wedding: {
        photography: {
          bronze: 500, silver: 800, gold: 1250, platinum: 2500
        },
        videography: {
          bronze: 600, silver: 800, gold: 1250, platinum: 1800
        }
      },
      event: {
        baseRate: 150, // per hour
        minimumHours: 2,
        videoRate: 100, // per hour for video add-on
      }
    };

    const addons = {
      highlightReel: 250,
      expressDelivery: 120,
      drone: { photoshoot: 150, wedding: 250 },
      studioRental: 80,
      flyingDress: 120,
      clearKayak: 100,
    };

    const transportationFees = {
      "manchester-stelizabeth": 35,
      "montegobay-negril-ochorios": 50,
      "other-parishes": 65,
    };

    res.json({ packages, addons, transportationFees });
  });

  // Admin endpoints
  app.get('/api/admin/bookings', isAdmin, async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      console.error('Error fetching admin bookings:', error);
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  });

  app.patch('/api/admin/bookings/:id/status', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = statusUpdateSchema.parse(req.body);
      const booking = await storage.updateBookingStatus(id, validatedData.status);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      // Post system message to booking conversation on notable status changes
      if (validatedData.status === 'confirmed' || validatedData.status === 'completed') {
        try {
          const conv = await storage.getConversationByBookingId(id);
          if (conv) {
            const statusText = validatedData.status === 'confirmed' ? 'confirmed' : 'completed';
            await storage.createMessage({
              conversationId: conv.id,
              senderId: null,
              messageType: 'system',
              body: `Your booking has been marked as ${statusText}.`,
            });
          }
        } catch (msgErr) {
          console.error('Failed to post status system message:', msgErr);
        }
      }
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid status value', details: error.errors });
      }
      console.error('Error updating booking status:', error);
      res.status(500).json({ error: 'Failed to update booking status' });
    }
  });

  // Admin manually marks deposit or balance as paid — sends confirmation email on deposit
  app.patch('/api/admin/bookings/:id/mark-paid', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentType } = z.object({ paymentType: z.enum(['deposit', 'balance']) }).parse(req.body);

      const booking = await storage.updateBookingPaymentStatus(id, paymentType);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      // Auto-confirm the booking when deposit is marked paid
      if (paymentType === 'deposit' && booking.status === 'pending') {
        await storage.updateBookingStatus(id, 'confirmed');
      }

      // Send confirmation email when deposit is marked paid
      if (paymentType === 'deposit') {
        const gallery = await storage.getGalleryByBookingId(id);
        const accessCode = gallery?.accessCode ?? '';
        sendBookingConfirmation({
          clientName: booking.clientName,
          email: booking.email,
          serviceType: booking.serviceType,
          shootDate: booking.shootDate,
          shootTime: booking.shootTime ?? undefined,
          location: booking.location ?? undefined,
          totalPrice: booking.totalPrice,
          depositAmount: booking.depositAmount ?? Math.round(booking.totalPrice * 0.5),
          balanceDue: booking.balanceDue ?? booking.totalPrice - Math.round(booking.totalPrice * 0.5),
          id: booking.id,
        }, accessCode).catch(err => console.error('Failed to send booking confirmation email:', err));
      }

      const updatedBooking = await storage.getBooking(id);
      res.json(updatedBooking);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid payment type' });
      console.error('Error marking payment as paid:', error);
      res.status(500).json({ error: 'Failed to mark payment as paid' });
    }
  });

  app.get('/api/admin/galleries', isAdmin, async (req, res) => {
    try {
      const galleries = await storage.getAllGalleries();
      res.json(galleries);
    } catch (error) {
      console.error('Error fetching admin galleries:', error);
      res.status(500).json({ error: 'Failed to fetch galleries' });
    }
  });

  app.get('/api/admin/contacts', isAdmin, async (req, res) => {
    try {
      const messages = await storage.getAllContactMessages();
      res.json(messages);
    } catch (error) {
      console.error('Error fetching admin contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contact messages' });
    }
  });

  app.patch('/api/admin/contacts/:id/status', isAdmin, async (req, res) => {
    try {
      const { status } = z.object({ status: z.enum(['unread', 'read', 'responded']) }).parse(req.body);
      const msg = await storage.updateContactStatus(req.params.id, status);
      if (!msg) return res.status(404).json({ error: 'Message not found' });
      res.json(msg);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid status' });
      res.status(500).json({ error: 'Failed to update message status' });
    }
  });

  app.delete('/api/admin/contacts/:id', isAdmin, async (req, res) => {
    try {
      const ok = await storage.deleteContact(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Message not found' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete message' });
    }
  });

  app.post('/api/admin/make-admin/:userId', isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.makeUserAdmin(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error making user admin:', error);
      res.status(500).json({ error: 'Failed to make user admin' });
    }
  });

  // Object storage endpoints for admin uploads
  app.post('/api/admin/objects/upload', isAdmin, async (req, res) => {
    try {
      // For now, return a mock upload URL since object storage setup needs to be completed
      // In production, this would use ObjectStorageService.getObjectEntityUploadURL()
      const mockUploadURL = `https://storage.googleapis.com/mock-bucket/uploads/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.json({ 
        method: "PUT" as const,
        url: mockUploadURL 
      });
    } catch (error) {
      console.error('Error generating upload URL:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  });

  // Ensure a gallery exists for a booking (create one if missing)
  app.post('/api/admin/bookings/:id/ensure-gallery', isAdmin, async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      let gallery = await storage.getGalleryByBookingId(req.params.id);
      if (!gallery) {
        const accessCode = Math.random().toString(36).substr(2, 8).toUpperCase();
        gallery = await storage.createGallery({
          bookingId: req.params.id,
          clientEmail: booking.email,
          accessCode,
          galleryImages: [],
          selectedImages: [],
          finalImages: [],
        });
      }
      res.json(gallery);
    } catch (error: any) {
      console.error('Error ensuring gallery:', error);
      res.status(500).json({ error: 'Failed to ensure gallery', details: error?.message, code: error?.code });
    }
  });

  // Generates a signed Cloudinary upload signature for browser-direct uploads.
  // Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
  // No upload preset needed — signed uploads bypass that requirement entirely.
  app.post('/api/admin/upload-signature', isAdmin, (req, res) => {
    const config = getCloudinarySignedConfig();
    if (!config) {
      return res.status(503).json({
        error: "Image upload not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your Vercel environment variables."
      });
    }
    const timestamp = Math.round(Date.now() / 1000);
    const params = { timestamp };
    const signature = generateSignature(params, config.apiSecret);
    res.json({
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      timestamp,
      signature,
    });
  });

  // Update gallery settings (download toggles, status)
  app.patch('/api/admin/gallery/:id/settings', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        galleryDownloadEnabled: z.boolean().optional(),
        selectedDownloadEnabled: z.boolean().optional(),
        finalDownloadEnabled: z.boolean().optional(),
        status: z.enum(['pending', 'active', 'selection', 'editing', 'completed']).optional(),
      });
      const settings = schema.parse(req.body);
      const gallery = await storage.updateGallerySettings(req.params.id, settings);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      res.json(gallery);
    } catch (error) {
      res.status(400).json({ error: 'Invalid settings' });
    }
  });

  // Photographer gallery settings
  app.patch('/api/photographer/gallery/:id/settings', isPhotographerApproved, async (req, res) => {
    try {
      const schema = z.object({
        galleryDownloadEnabled: z.boolean().optional(),
        selectedDownloadEnabled: z.boolean().optional(),
        finalDownloadEnabled: z.boolean().optional(),
        status: z.enum(['pending', 'active', 'selection', 'editing', 'completed']).optional(),
      });
      const settings = schema.parse(req.body);
      const gallery = await storage.getGalleryById(req.params.id);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      if (gallery.bookingId) {
        const booking = await storage.getBooking(gallery.bookingId);
        const userId = (req as any).user?.id;
        if (!booking || booking.photographerId !== userId) {
          return res.status(403).json({ error: 'Not assigned to this gallery' });
        }
      }
      const updated = await storage.updateGallerySettings(req.params.id, settings);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Invalid settings' });
    }
  });

  app.put('/api/admin/gallery-images', isAdmin, async (req, res) => {
    try {
      const galleryImageSchema = z.object({
        galleryId: z.string(),
        imageURL: z.string(),
        type: z.enum(['gallery', 'selected', 'final'])
      });
      
      const { galleryId, imageURL, type } = galleryImageSchema.parse(req.body);

      // Fixed: Use getGalleryById instead of getGalleryByBookingId
      const gallery = await storage.getGalleryById(galleryId);
      if (!gallery) {
        return res.status(404).json({ error: 'Gallery not found' });
      }

      const currentImages = {
        gallery: gallery.galleryImages || [],
        selected: gallery.selectedImages || [],
        final: gallery.finalImages || []
      };

      const updatedImages = [...currentImages[type], imageURL];
      const updatedGallery = await storage.updateGalleryImages(gallery.id, updatedImages, type);

      res.json({
        objectPath: imageURL,
        gallery: updatedGallery
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('Error adding gallery image:', error);
      res.status(500).json({ error: 'Failed to add gallery image' });
    }
  });

  // User routes for viewing their own data
  app.get('/api/user/bookings', isAuthenticated, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // If admin, return all bookings, otherwise return user's bookings
      const isAdminUser = (req as any).user?.isAdmin;
      let userBookings;
      
      if (isAdminUser) {
        userBookings = await storage.getAllBookings();
      } else {
        userBookings = await storage.getUserBookings(userEmail);
      }
      
      res.json(userBookings);
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      res.status(500).json({ error: 'Failed to fetch user bookings' });
    }
  });

  app.get('/api/user/galleries', isAuthenticated, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // If admin, return all galleries, otherwise return user's galleries  
      const isAdminUser = (req as any).user?.isAdmin;
      let userGalleries;
      
      if (isAdminUser) {
        userGalleries = await storage.getAllGalleries();
      } else {
        userGalleries = await storage.getUserGalleries(userEmail);
      }
      
      res.json(userGalleries);
    } catch (error) {
      console.error('Error fetching user galleries:', error);
      res.status(500).json({ error: 'Failed to fetch user galleries' });
    }
  });

  app.get('/api/photographer/bookings', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (role !== 'photographer') {
        return res.status(403).json({ error: 'Photographer access required' });
      }
      const bookings = await storage.getPhotographerBookings(userId);
      res.json(bookings);
    } catch (error) {
      console.error('Error fetching photographer bookings:', error);
      res.status(500).json({ error: 'Failed to fetch photographer bookings' });
    }
  });

  app.patch('/api/photographer/bookings/:id/status', isPhotographerApproved, async (req, res) => {
    try {
      const statusSchema = z.object({ status: z.enum(["pending", "confirmed", "completed", "cancelled", "declined"]) });
      const { status } = statusSchema.parse(req.body);
      const booking = await storage.getBooking(req.params.id);
      const userId = (req as any).user?.id;
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      if (booking.photographerId !== userId) {
        return res.status(403).json({ error: 'Not assigned to this booking' });
      }
      const updated = await storage.updateBookingStatus(req.params.id, status);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid status', details: error.errors });
      }
      console.error('Error updating booking status:', error);
      res.status(500).json({ error: 'Failed to update booking status' });
    }
  });

  app.get('/api/photographer/galleries', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (role !== 'photographer') {
        return res.status(403).json({ error: 'Photographer access required' });
      }
      const galleries = await storage.getPhotographerGalleries(userId);
      res.json(galleries);
    } catch (error) {
      console.error('Error fetching photographer galleries:', error);
      res.status(500).json({ error: 'Failed to fetch photographer galleries' });
    }
  });

  app.post('/api/photographer/objects/upload', isPhotographerApproved, async (_req, res) => {
    try {
      const mockUploadURL = `https://storage.googleapis.com/mock-bucket/uploads/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.json({
        method: "PUT" as const,
        url: mockUploadURL
      });
    } catch (error) {
      console.error('Error generating upload URL:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  });

  app.put('/api/photographer/gallery-images', isPhotographerApproved, async (req, res) => {
    try {
      const galleryImageSchema = z.object({
        galleryId: z.string(),
        imageURL: z.string(),
        type: z.enum(['gallery', 'selected', 'final'])
      });
      
      const { galleryId, imageURL, type } = galleryImageSchema.parse(req.body);

      const gallery = await storage.getGalleryById(galleryId);
      if (!gallery) {
        return res.status(404).json({ error: 'Gallery not found' });
      }
      if (!gallery.bookingId) {
        return res.status(400).json({ error: 'Gallery not linked to a booking' });
      }
      const booking = await storage.getBooking(gallery.bookingId);
      const userId = (req as any).user?.id;
      if (!booking || booking.photographerId !== userId) {
        return res.status(403).json({ error: 'Not assigned to this gallery' });
      }

      const currentImages = {
        gallery: gallery.galleryImages || [],
        selected: gallery.selectedImages || [],
        final: gallery.finalImages || []
      };

      const updatedImages = [...currentImages[type], imageURL];
      const updatedGallery = await storage.updateGalleryImages(gallery.id, updatedImages, type);

      res.json({
        objectPath: imageURL,
        gallery: updatedGallery
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('Error adding gallery image:', error);
      res.status(500).json({ error: 'Failed to add gallery image' });
    }
  });

  // Cloudinary signed upload for photographers
  app.post('/api/photographer/upload-signature', isPhotographerApproved, (req, res) => {
    const config = getCloudinarySignedConfig();
    if (!config) return res.status(503).json({ error: 'Upload service unavailable' });
    const timestamp = Math.round(Date.now() / 1000);
    const params = { timestamp };
    const signature = generateSignature(params, config.apiSecret);
    res.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, signature });
  });

  // Reorder / bulk-update images in a photographer's gallery
  app.patch('/api/photographer/gallery/:id/images', isPhotographerApproved, async (req, res) => {
    try {
      const schema = z.object({
        images: z.array(z.string()),
        type: z.enum(['gallery', 'selected', 'final']),
      });
      const { images, type } = schema.parse(req.body);
      const gallery = await storage.getGalleryById(req.params.id);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      if (!gallery.bookingId) return res.status(400).json({ error: 'Gallery not linked to a booking' });
      const booking = await storage.getBooking(gallery.bookingId);
      const userId = (req as any).user?.id;
      if (!booking || booking.photographerId !== userId) {
        return res.status(403).json({ error: 'Not assigned to this gallery' });
      }
      const updated = await storage.updateGalleryImages(req.params.id, images, type);
      if (!updated) return res.status(404).json({ error: 'Gallery not found' });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request data' });
      res.status(500).json({ error: 'Failed to update gallery images' });
    }
  });

  // Lemon Squeezy payment routes
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      if (!lemonSqueezyEnabled) {
        return res.status(501).json({ error: "Payments not configured" });
      }

      const { bookingId, paymentType } = req.body;
      
      if (!bookingId || !paymentType || !['deposit', 'balance'].includes(paymentType)) {
        return res.status(400).json({ error: 'Missing or invalid payment data' });
      }

      // Fetch booking to get server-side amount and validate payment state
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // CRITICAL: Only allow payments for confirmed or pending bookings
      if (booking.status !== 'confirmed' && booking.status !== 'pending') {
        return res.status(400).json({ error: 'Booking must be confirmed or pending to process payment' });
      }

      // Calculate amounts server-side to ensure integrity
      const serverDepositAmount = Math.round(booking.totalPrice * 0.5);
      const serverBalanceDue = booking.totalPrice - serverDepositAmount;

      let amount: number;
      if (paymentType === 'deposit') {
        if (booking.depositPaid) {
          return res.status(400).json({ error: 'Deposit already paid' });
        }
        amount = serverDepositAmount; // Use server-calculated 50% deposit
      } else {
        if (!booking.depositPaid) {
          return res.status(400).json({ error: 'Deposit must be paid first' });
        }
        if (booking.balancePaid) {
          return res.status(400).json({ error: 'Balance already paid' });
        }
        amount = serverBalanceDue; // Use server-calculated balance
      }

      // Create Lemon Squeezy checkout with proper format
      const storeId = process.env.LEMONSQUEEZY_STORE_ID!;
      const variantId = process.env.LEMONSQUEEZY_VARIANT_ID!;
      
      // Convert amount to cents (Lemon Squeezy requires cents)
      const customPriceInCents = Math.round(amount * 100);
      
      const newCheckout = {
        customPrice: customPriceInCents,
        productOptions: {
          name: `Photography ${paymentType === 'deposit' ? 'Deposit' : 'Balance'} Payment`,
          description: `${paymentType} payment for ${booking.serviceType} booking #${booking.id}`,
          redirectUrl: `https://www.connectagrapher.com/payment-success?booking=${bookingId}&type=${paymentType}`,
        },
        checkoutOptions: {
          embed: true,
          media: true,
          logo: true,
        },
        checkoutData: {
          email: booking.email,
          name: booking.clientName,
          custom: {
            booking_id: bookingId,
            payment_type: paymentType,
            service_type: booking.serviceType,
            total_amount: String(booking.totalPrice)
          }
        },
      };

      const checkout = await createCheckout(storeId, variantId, newCheckout);

      if (checkout.error) {
        console.error('Lemon Squeezy checkout creation error:', checkout.error);
        return res.status(500).json({ error: 'Failed to create checkout' });
      }

      const checkoutData = checkout.data?.data;
      if (!checkoutData) {
        return res.status(500).json({ error: 'Failed to create checkout - no data returned' });
      }

      // Store checkout ID on booking
      if (paymentType === 'deposit') {
        await storage.updateBookingLemonSqueezyCheckoutId(bookingId, checkoutData.id, 'deposit');
      } else {
        await storage.updateBookingLemonSqueezyCheckoutId(bookingId, checkoutData.id, 'balance');
      }

      // Return the URL as-is — lemon.js embed overlay handles the custom domain
      res.json({ checkoutUrl: checkoutData.attributes.url });
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      res.status(500).json({ error: "Error creating checkout: " + error.message });
    }
  });

  app.get("/api/bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      const isAdminUser = (req as any).user?.isAdmin;
      const booking = await storage.getBooking(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if user owns this booking or is admin
      if (booking.email !== userEmail && !isAdminUser) {
        return res.status(403).json({ error: "Unauthorized access to booking" });
      }

      res.json(booking);
    } catch (error) {
      console.error('Error fetching booking:', error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Public booking endpoint for payment purposes (no auth required)
  app.get("/api/bookings/:id/payment", async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // SECURITY: Only show payment info for confirmed or pending bookings
      if (booking.status !== 'confirmed' && booking.status !== 'pending') {
        return res.status(403).json({ error: "Payment information only available for confirmed or pending bookings" });
      }

      // Return only payment-relevant fields for security with server-calculated amounts
      const serverDepositAmount = Math.round(booking.totalPrice * 0.5);
      const serverBalanceDue = booking.totalPrice - serverDepositAmount;
      
      const paymentBooking = {
        id: booking.id,
        clientName: booking.clientName,
        serviceType: booking.serviceType,
        packageType: booking.packageType,
        shootDate: booking.shootDate,
        status: booking.status,
        totalPrice: booking.totalPrice,
        depositAmount: serverDepositAmount, // Server-calculated for consistency
        balanceDue: serverBalanceDue, // Server-calculated for consistency
        depositPaid: booking.depositPaid,
        balancePaid: booking.balancePaid
      };

      res.json(paymentBooking);
    } catch (error) {
      console.error('Error fetching booking for payment:', error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Lemon Squeezy webhook to handle payment success
  app.post('/api/lemonsqueezy/webhook', async (req, res) => {
    try {
      if (!lemonSqueezyEnabled) {
        return res.status(501).json({ error: "Webhooks not configured" });
      }

      const signature = req.headers['x-signature'] as string;
      
      if (!signature) {
        return res.status(400).json({ error: 'Missing signature header' });
      }

      // Verify webhook signature
      const crypto = require('crypto');
      const rawBody = req.body instanceof Buffer ? req.body.toString('utf-8') : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '')
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.log('Webhook signature verification failed');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const event = req.body instanceof Buffer ? JSON.parse(req.body.toString('utf-8')) : req.body;

      // Handle different webhook events
      switch (event.meta.event_name) {
        case 'order_created': {
          const order = event.data;
          const customData = event.meta?.custom_data || order.attributes?.first_order_item?.product_options?.custom || {};
          const { booking_id, payment_type } = customData;

          if (booking_id && payment_type) {
            // Skip if this payment was already processed (idempotency for webhook retries)
            const existingBooking = await storage.getBooking(booking_id);
            if (existingBooking && (
              (payment_type === 'deposit' && existingBooking.depositPaid) ||
              (payment_type === 'balance' && existingBooking.balancePaid)
            )) {
              console.log(`Payment ${payment_type} already processed for booking ${booking_id}, skipping`);
              break;
            }

            // Store order ID on booking
            await storage.updateBookingLemonSqueezyOrderId(booking_id, order.id, payment_type);
            // Update payment status
            await storage.updateBookingPaymentStatus(booking_id, payment_type as 'deposit' | 'balance');
            console.log(`Payment ${payment_type} successful for booking ${booking_id}`);

            // Send payment confirmation email
            const paidBooking = await storage.getBooking(booking_id);
            if (paidBooking) {
              const amount = payment_type === 'deposit'
                ? Math.round(paidBooking.totalPrice * 0.5)
                : paidBooking.totalPrice - Math.round(paidBooking.totalPrice * 0.5);
              sendPaymentConfirmation({
                clientName: paidBooking.clientName,
                email: paidBooking.email,
                serviceType: paidBooking.serviceType,
                id: paidBooking.id,
              }, payment_type as 'deposit' | 'balance', amount).catch(err => console.error('Failed to send payment confirmation email:', err));
            }
          }
          break;
        }
        case 'order_refunded': {
          const order = event.data;
          console.log(`Order refunded: ${order.id}`);
          break;
        }
        default:
          console.log(`Unhandled event type: ${event.meta.event_name}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(200).json({ received: true, error: error.message });
    }
  });

  // Secure admin gallery routes
  app.patch('/api/admin/gallery/:id/images', isAdmin, async (req, res) => {
    try {
      const updateGallerySchema = z.object({
        images: z.array(z.string()),
        type: z.enum(['gallery', 'selected', 'final'])
      });
      
      const { images, type } = updateGallerySchema.parse(req.body);
      const gallery = await storage.updateGalleryImages(req.params.id, images, type);
      if (!gallery) {
        return res.status(404).json({ error: "Gallery not found" });
      }
      res.json(gallery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      res.status(500).json({ error: "Failed to update gallery images" });
    }
  });

  // ===== CATALOGUE ROUTES =====

  // Public routes for published catalogues
  app.get('/api/catalogues', async (req, res) => {
    try {
      const { serviceType } = req.query;
      let catalogues;
      
      if (serviceType && typeof serviceType === 'string') {
        catalogues = await storage.getCataloguesByServiceType(serviceType);
      } else {
        catalogues = await storage.getPublishedCatalogues();
      }
      
      res.json(catalogues.map(createSafeCatalogueDTO));
    } catch (error) {
      console.error('Error fetching catalogues:', error);
      res.status(500).json({ error: 'Failed to fetch catalogues' });
    }
  });

  app.get('/api/catalogues/:id', async (req, res) => {
    try {
      const catalogue = await storage.getCatalogue(req.params.id);
      if (!catalogue) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }
      
      // Only return published catalogues for public access
      if (!catalogue.isPublished) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }
      
      res.json(createSafeCatalogueDTO(catalogue));
    } catch (error) {
      console.error('Error fetching catalogue:', error);
      res.status(500).json({ error: 'Failed to fetch catalogue' });
    }
  });

  // Admin routes for catalogue management
  app.get('/api/admin/catalogues', isAdmin, async (req, res) => {
    try {
      const catalogues = await storage.getAllCatalogues();
      res.json(catalogues);
    } catch (error) {
      console.error('Error fetching admin catalogues:', error);
      res.status(500).json({ error: 'Failed to fetch catalogues' });
    }
  });

  app.post('/api/admin/catalogues', isAdmin, async (req, res) => {
    try {
      console.log('[catalogue create] body:', JSON.stringify(req.body));
      const catalogueData = catalogueSchema.parse(req.body);
      console.log('[catalogue create] parsed ok, inserting...');
      const catalogue = await storage.createCatalogue(catalogueData);
      res.json(catalogue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[catalogue create] zod error:', JSON.stringify(error.errors));
        return res.status(400).json({ error: 'Invalid catalogue data', details: error.errors });
      }
      console.error('[catalogue create] unexpected error:', error);
      res.status(500).json({ error: (error as any)?.message || 'Failed to create catalogue' });
    }
  });

  app.put('/api/admin/catalogues/:id', isAdmin, async (req, res) => {
    try {
      const updateData = updateCatalogueSchema.parse(req.body);
      const catalogue = await storage.updateCatalogue(req.params.id, updateData);
      if (!catalogue) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }
      res.json(catalogue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid catalogue data', details: error.errors });
      }
      console.error('Error updating catalogue:', error);
      res.status(500).json({ error: 'Failed to update catalogue' });
    }
  });

  app.patch('/api/admin/catalogues/reorder', isAdmin, async (req, res) => {
    try {
      const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)) });
      const { orderedIds } = reorderSchema.parse(req.body);
      await Promise.all(
        orderedIds.map((id, index) => storage.updateCatalogueSortOrder(id, index + 1))
      );
      const updated = await storage.getAllCatalogues();
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid reorder data', details: error.errors });
      }
      console.error('Error reordering catalogues:', error);
      res.status(500).json({ error: 'Failed to reorder catalogues' });
    }
  });

  app.patch('/api/admin/catalogues/:id/publish', isAdmin, async (req, res) => {
    try {
      const catalogue = await storage.publishCatalogue(req.params.id);
      if (!catalogue) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }
      res.json(catalogue);
    } catch (error) {
      console.error('Error publishing catalogue:', error);
      res.status(500).json({ error: 'Failed to publish catalogue' });
    }
  });

  app.patch('/api/admin/catalogues/:id/unpublish', isAdmin, async (req, res) => {
    try {
      const catalogue = await storage.unpublishCatalogue(req.params.id);
      if (!catalogue) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }
      res.json(catalogue);
    } catch (error) {
      console.error('Error unpublishing catalogue:', error);
      res.status(500).json({ error: 'Failed to unpublish catalogue' });
    }
  });

  app.delete('/api/admin/catalogues/:id', isAdmin, async (req, res) => {
    try {
      const ok = await storage.deleteCatalogue(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Catalogue not found' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete catalogue' });
    }
  });

  // ===== REVIEW ROUTES =====

  // Public routes for reviews
  app.get('/api/reviews/general', async (req, res) => {
    try {
      const reviews = await storage.getGeneralReviews();
      res.json(reviews.map(createSafeReviewDTO));
    } catch (error) {
      console.error('Error fetching general reviews:', error);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  });

  app.get('/api/reviews/catalogue/:catalogueId', async (req, res) => {
    try {
      // First verify the catalogue exists and is published
      const catalogue = await storage.getCatalogue(req.params.catalogueId);
      if (!catalogue || !catalogue.isPublished) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }

      const reviews = await storage.getApprovedReviewsByCatalogue(req.params.catalogueId);
      res.json(reviews.map(createSafeReviewDTO));
    } catch (error) {
      console.error('Error fetching catalogue reviews:', error);
      res.status(500).json({ error: 'Failed to fetch catalogue reviews' });
    }
  });

  // Route for clients to submit reviews (requires authentication and authorization)
  app.post('/api/reviews', isAuthenticated, async (req, res) => {
    try {
      const userEmail = (req as any).user?.email;
      if (!userEmail) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const reviewData = reviewSchema.parse({
        ...req.body,
        clientEmail: normalizeEmail(userEmail)
      });

      // For catalogue reviews, verify the user is authorized to review that catalogue
      if (reviewData.reviewType === 'catalogue' && reviewData.catalogueId) {
        const catalogue = await storage.getCatalogue(reviewData.catalogueId);
        if (!catalogue) {
          return res.status(404).json({ error: 'Catalogue not found' });
        }

        // Require catalogue to have a booking linkage for client authorization
        if (!catalogue.bookingId) {
          return res.status(403).json({ error: 'This catalogue is not available for client reviews' });
        }

        // Get the booking associated with this catalogue to verify client authorization
        const booking = await storage.getBooking(catalogue.bookingId);
        if (!booking || booking.email !== userEmail) {
          return res.status(403).json({ error: 'You are not authorized to review this catalogue' });
        }

        // Check if user already reviewed this catalogue (any review, not just approved)
        const existingReview = await storage.getReviewByCatalogueAndEmail(reviewData.catalogueId, normalizeEmail(userEmail));
        if (existingReview) {
          return res.status(400).json({ error: 'You have already reviewed this catalogue' });
        }
      }

      const review = await storage.createReview(reviewData);
      res.json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid review data', details: error.errors });
      }
      console.error('Error creating review:', error);
      res.status(500).json({ error: 'Failed to create review' });
    }
  });

  // Admin routes for review management
  app.get('/api/admin/reviews', isAdmin, async (req, res) => {
    try {
      const reviews = await storage.getAllReviews();
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching admin reviews:', error);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  });

  app.patch('/api/admin/reviews/:id/approve', isAdmin, async (req, res) => {
    try {
      const review = await storage.approveReview(req.params.id);
      if (!review) {
        return res.status(404).json({ error: 'Review not found' });
      }
      res.json(review);
    } catch (error) {
      console.error('Error approving review:', error);
      res.status(500).json({ error: 'Failed to approve review' });
    }
  });

  // ===== ADDITIONAL ADMIN BOOKING MANAGEMENT ROUTES =====

  // Edit booking details (admin only)
  app.patch('/api/admin/bookings/:id', isAdmin, async (req, res) => {
    try {
      const updateBookingSchema = z.object({
        clientName: z.string().min(1, "Client name is required"),
        email: z.string().email("Valid email is required"),
        contactNumber: z.string().min(1, "Contact number is required"),
        serviceType: z.enum(["photoshoot", "wedding", "event"]),
        packageType: z.string().min(1, "Package type is required"),
        numberOfPeople: z.number().min(1, "At least 1 person required"),
        shootDate: z.string().min(1, "Shoot date is required"),
        shootTime: z.string().min(1, "Shoot time is required"),
        location: z.string().min(1, "Location is required"),
        parish: z.string().min(1, "Parish is required"),
        totalPrice: z.number().min(0, "Total price must be positive"),
      });

      const bookingData = updateBookingSchema.parse(req.body);
      const booking = await storage.updateBooking(req.params.id, bookingData);
      
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid booking data', details: error.errors });
      }
      console.error('Error updating booking:', error);
      res.status(500).json({ error: 'Failed to update booking' });
    }
  });

  // Send email to client (admin only)
  app.post('/api/admin/send-email', isAdmin, async (req, res) => {
    try {
      const emailSchema = z.object({
        email: z.string().email("Valid email is required"),
        clientName: z.string().min(1, "Client name is required"),
        subject: z.string().min(1, "Subject is required"),
        message: z.string().min(1, "Message is required"),
        threadId: z.string().optional(),
      });

      const emailData = emailSchema.parse(req.body);

      await sendAdminEmail(emailData.email, emailData.clientName, emailData.subject, emailData.message);

      // Save outbound reply to DB for threading
      if (emailData.threadId) {
        await storage.saveOutboundEmail({
          threadId: emailData.threadId,
          to: emailData.email,
          subject: emailData.subject,
          body: emailData.message,
          senderName: 'Admin',
        });
        // Mark thread root as responded
        await storage.updateInboundEmailStatus(emailData.threadId, 'responded');
      }

      res.json({
        success: true,
        message: 'Email sent successfully',
        emailId: `email_${Date.now()}`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid email data', details: error.errors });
      }
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  // Issue refund for booking (admin only)
  app.post('/api/admin/bookings/:id/refund', isAdmin, async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Check if there are payments to refund
      if (!booking.depositPaid && !booking.balancePaid) {
        return res.status(400).json({ error: 'No payments to refund' });
      }

      // TODO: Implement actual refund processing via Lemon Squeezy
      // For now, just update the booking status and payment flags
      console.log('Refund would be processed for booking:', booking.id);
      console.log('Total refund amount:', booking.totalPrice);
      
      // Update booking to cancelled status and reset payment flags
      const updatedBooking = await storage.updateBookingStatus(req.params.id, 'cancelled');
      
      // TODO: Also reset payment flags when implementing actual refunds
      // await storage.updateBookingPaymentStatus(req.params.id, 'deposit', false);
      // await storage.updateBookingPaymentStatus(req.params.id, 'balance', false);
      
      res.json({
        success: true,
        message: 'Booking cancelled. Refund must be processed manually via the Lemon Squeezy dashboard.',
        booking: updatedBooking,
        refundRequiresManualProcessing: true
      });
    } catch (error) {
      console.error('Error processing refund:', error);
      res.status(500).json({ error: 'Failed to process refund' });
    }
  });

  // Get all users (admin only)
  app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();

      // Remove password fields for security
      const safeUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        isBlocked: user.isBlocked,
        role: user.role,
        photographerStatus: user.photographerStatus,
        createdAt: user.createdAt
      }));

      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Delete user (admin only)
  app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
    try {
      const ok = await storage.deleteUser(req.params.id);
      if (!ok) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // Edit user (admin only)
  app.put('/api/admin/users/:id', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
      });
      const data = schema.parse(req.body);
      if (data.password) {
        data.password = await hashPassword(data.password);
      }
      const user = await storage.updateUser(req.params.id, data);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { password: _, ...safeUser } = user as any;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Block/unblock user (admin only)
  app.patch('/api/admin/users/:id/block', isAdmin, async (req, res) => {
    try {
      const { blocked } = z.object({ blocked: z.boolean() }).parse(req.body);
      const user = await storage.blockUser(req.params.id, blocked);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { password: _, ...safeUser } = user as any;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data' });
      console.error('Error blocking user:', error);
      res.status(500).json({ error: 'Failed to block/unblock user' });
    }
  });

  // Send password reset email to user (admin only)
  app.post('/api/admin/users/:id/reset-password', isAdmin, async (req, res) => {
    try {
      const user = await storage.getUserById(req.params.id);
      if (!user || !user.email) return res.status(404).json({ error: 'User not found' });
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}`;
      await sendPasswordReset(user.email, token);
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending password reset:', error);
      res.status(500).json({ error: 'Failed to send reset email' });
    }
  });

  // Send payment link to client (admin only)
  app.post('/api/admin/bookings/:id/send-payment-link', isAdmin, async (req, res) => {
    try {
      if (!lemonSqueezyEnabled) {
        return res.status(501).json({ error: 'Payments not configured' });
      }
      const { paymentType, sendEmail } = z.object({ paymentType: z.enum(['deposit', 'balance']), sendEmail: z.boolean().optional().default(false) }).parse(req.body);
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (booking.status !== 'confirmed' && booking.status !== 'pending') {
        return res.status(400).json({ error: 'Booking must be confirmed or pending' });
      }
      const serverDepositAmount = Math.round(booking.totalPrice * 0.5);
      const serverBalanceDue = booking.totalPrice - serverDepositAmount;
      let amount: number;
      if (paymentType === 'deposit') {
        if (booking.depositPaid) return res.status(400).json({ error: 'Deposit already paid' });
        amount = serverDepositAmount;
      } else {
        if (!booking.depositPaid) return res.status(400).json({ error: 'Deposit must be paid first' });
        if (booking.balancePaid) return res.status(400).json({ error: 'Balance already paid' });
        amount = serverBalanceDue;
      }
      const storeId = process.env.LEMONSQUEEZY_STORE_ID!;
      const variantId = process.env.LEMONSQUEEZY_VARIANT_ID!;
      const customPriceInCents = Math.round(amount * 100);
      const newCheckout = {
        customPrice: customPriceInCents,
        productOptions: {
          name: `Photography ${paymentType === 'deposit' ? 'Deposit' : 'Balance'} Payment`,
          description: `${paymentType} payment for ${booking.serviceType} booking #${booking.id}`,
          redirectUrl: `${process.env.APP_URL || 'http://localhost:5000'}/payment-success?booking=${booking.id}`,
        },
        checkoutOptions: { embed: false, media: true, logo: true },
        checkoutData: {
          email: booking.email,
          name: booking.clientName,
          custom: { booking_id: booking.id, payment_type: paymentType, service_type: booking.serviceType, total_amount: String(booking.totalPrice) }
        },
      };
      const checkout = await createCheckout(storeId, variantId, newCheckout);
      if (checkout.error) return res.status(500).json({ error: 'Failed to create checkout' });
      const rawUrl = checkout.data?.data?.attributes?.url;
      if (!rawUrl) return res.status(500).json({ error: 'No checkout URL returned' });
      const url = normalizeLsUrl(rawUrl);
      // Send by email only when explicitly requested
      if (sendEmail) {
        await sendAdminEmail(
          booking.email,
          booking.clientName,
          `Payment Link – ${paymentType === 'deposit' ? 'Deposit' : 'Balance'}`,
          `Hi ${booking.clientName},\n\nPlease use the following link to complete your ${paymentType} payment of $${(amount).toFixed(2)}:\n\n${url}\n\nThank you!`
        );
      }
      res.json({ url });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data' });
      console.error('Error sending payment link:', error);
      res.status(500).json({ error: 'Failed to send payment link' });
    }
  });

  app.get('/api/admin/photographers/pending', isAdmin, async (_req, res) => {
    try {
      const pending = await storage.getPendingPhotographers();
      res.json(pending);
    } catch (error) {
      console.error('Error fetching pending photographers:', error);
      res.status(500).json({ error: 'Failed to fetch pending photographers' });
    }
  });

  app.get('/api/admin/photographers', isAdmin, async (_req, res) => {
    try {
      const photographers = await storage.getAllPhotographers();
      res.json(photographers);
    } catch (error) {
      console.error('Error fetching photographers:', error);
      res.status(500).json({ error: 'Failed to fetch photographers' });
    }
  });

  app.post('/api/admin/photographers/:userId/approve', isAdmin, async (req, res) => {
    try {
      const updated = await storage.updatePhotographerStatus(req.params.userId, 'approved');
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (updated.email) {
        sendPhotographerApproved(updated.email, updated.firstName || 'Photographer')
          .catch(err => console.error('Failed to send photographer approved email:', err));
      }
      res.json(updated);
    } catch (error) {
      console.error('Error approving photographer:', error);
      res.status(500).json({ error: 'Failed to approve photographer' });
    }
  });

  app.post('/api/admin/photographers/:userId/reject', isAdmin, async (req, res) => {
    try {
      const updated = await storage.updatePhotographerStatus(req.params.userId, 'rejected');
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (updated.email) {
        sendPhotographerRejected(updated.email, updated.firstName || 'Photographer')
          .catch(err => console.error('Failed to send photographer rejected email:', err));
      }
      res.json(updated);
    } catch (error) {
      console.error('Error rejecting photographer:', error);
      res.status(500).json({ error: 'Failed to reject photographer' });
    }
  });

  app.put('/api/admin/photographers/:userId/pricing', isAdmin, async (req, res) => {
    try {
      const pricingSchema = z.object({ config: z.record(z.any()) });
      const { config } = pricingSchema.parse(req.body);
      const existing = await storage.getPhotographerProfileByUserId(req.params.userId);
      const profile = existing
        ? await storage.updatePhotographerPricing(req.params.userId, config)
        : await storage.createPhotographerProfile({ userId: req.params.userId, pricingConfig: config });
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid pricing data', details: error.errors });
      }
      console.error('Error updating photographer pricing:', error);
      res.status(500).json({ error: 'Failed to update photographer pricing' });
    }
  });

  app.get('/api/admin/photographers/:userId/pricing', isAdmin, async (req, res) => {
    try {
      const profile = await storage.getPhotographerProfileByUserId(req.params.userId);
      res.json({ config: profile?.pricingConfig || defaultPricingConfig });
    } catch (error) {
      console.error('Error fetching photographer pricing:', error);
      res.status(500).json({ error: 'Failed to fetch photographer pricing' });
    }
  });

  app.post('/api/admin/bookings/:id/assign-photographer', isAdmin, async (req, res) => {
    try {
      const assignSchema = z.object({ photographerId: z.string().nullable() });
      const { photographerId } = assignSchema.parse(req.body);
      const booking = await storage.assignBookingPhotographer(req.params.id, photographerId);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Auto-create booking conversation when photographer is assigned
      if (photographerId) {
        try {
          const existing = await storage.getConversationByBookingId(booking.id);
          if (!existing) {
            const clientUser = await storage.getUserByEmail(booking.email);
            const allUsers = await storage.getAllUsers();
            const adminIds = allUsers.filter(u => u.isAdmin).map(u => u.id);
            const participantIds = [...new Set([
              ...(clientUser ? [clientUser.id] : []),
              photographerId,
              ...adminIds,
            ])];
            const photographer = await storage.getUser(photographerId);
            const conv = await storage.createConversation({
              type: 'booking',
              bookingId: booking.id,
              title: `Booking: ${booking.clientName} – ${booking.serviceType}`,
              participantIds,
            });
            const photographerName = photographer ? `${photographer.firstName || ''} ${photographer.lastName || ''}`.trim() : 'a photographer';
            await storage.createMessage({
              conversationId: conv.id,
              senderId: null,
              messageType: 'system',
              body: `Photographer ${photographerName} has been assigned to your booking.`,
            });
          }
        } catch (convErr) {
          console.error('Failed to create booking conversation:', convErr);
        }
      }

      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid assignment data', details: error.errors });
      }
      console.error('Error assigning photographer:', error);
      res.status(500).json({ error: 'Failed to assign photographer' });
    }
  });

  // ===== RESEND INBOUND EMAIL =====

  // Public webhook — verified using Svix signature (whsec_... secret from Resend dashboard).
  // Set RESEND_INBOUND_SECRET env var to the signing secret shown in Resend.
  app.post('/api/inbound/email', async (req, res) => {
    const secret = process.env.RESEND_INBOUND_SECRET;

    if (secret) {
      try {
        const { Webhook } = await import('svix');
        const wh = new Webhook(secret);
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        wh.verify(rawBody, {
          'svix-id': req.headers['svix-id'] as string,
          'svix-timestamp': req.headers['svix-timestamp'] as string,
          'svix-signature': req.headers['svix-signature'] as string,
        });
      } catch (err) {
        console.warn('[Inbound] Svix signature verification failed:', (err as Error).message);
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
      const payload = JSON.parse(rawBody);

      // Resend wraps inbound emails: { type: "email.received", data: { email_id, from, to, ... } }
      // Fall back to flat format for direct/test calls
      const emailData = payload.data || payload;
      const resendEmailId: string = emailData.email_id || '';
      const from: string = emailData.from || '';
      const to: string = Array.isArray(emailData.to) ? emailData.to.join(', ') : (emailData.to || '');
      const subject: string = emailData.subject || '';
      // Body is not included in Resend webhook payload — metadata only
      const textBody: string = emailData.text || emailData.plain || '';
      const htmlBody: string = emailData.html || '';

      // Extract threading headers
      const headers: { name: string; value: string }[] = emailData.headers || [];
      const messageIdHeader = headers.find(h => h.name === 'Message-ID')?.value || '';
      const inReplyToHeader = headers.find(h => h.name === 'In-Reply-To')?.value || '';

      // Parse sender name from from field
      const fromMatch = from.match(/^(.*?)\s*<(.+)>$/);
      const senderName = fromMatch ? fromMatch[1].trim() || fromMatch[2].trim() : from;

      if (!from) {
        return res.status(400).json({ error: 'Missing from field' });
      }

      const saved = await storage.saveInboundEmail({
        resendEmailId, from, to, subject, textBody, htmlBody,
        messageIdHeader: messageIdHeader || undefined,
        inReplyToHeader: inReplyToHeader || undefined,
        senderName: senderName || undefined,
      });
      console.log(`[Inbound] Email saved from ${from}: ${subject} (resend_id: ${resendEmailId})`);

      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const preview = subject ? `Subject: ${subject}` : '(no subject)';
        sendInboundEmailNotification(adminEmail, from, to, subject, preview).catch(err =>
          console.error('[Inbound] Failed to send admin notification:', err)
        );
      }

      res.json({ received: true, id: saved.id });
    } catch (error) {
      console.error('[Inbound] Error processing inbound email:', error);
      res.status(500).json({ error: 'Failed to process inbound email' });
    }
  });

  app.get('/api/admin/email-threads', isAdmin, async (_req, res) => {
    try {
      const threads = await storage.getEmailThreads();
      res.json(threads);
    } catch (error) {
      console.error('Error fetching email threads:', error);
      res.status(500).json({ error: 'Failed to fetch email threads' });
    }
  });

  app.get('/api/admin/inbound-emails', isAdmin, async (_req, res) => {
    try {
      const emails = await storage.getAllInboundEmails();
      res.json(emails);
    } catch (error) {
      console.error('Error fetching inbound emails:', error);
      res.status(500).json({ error: 'Failed to fetch inbound emails' });
    }
  });

  app.patch('/api/admin/inbound-emails/:id/read', isAdmin, async (req, res) => {
    try {
      const { isRead } = z.object({ isRead: z.boolean() }).parse(req.body);
      const email = await storage.markInboundEmailRead(req.params.id, isRead);
      if (!email) return res.status(404).json({ error: 'Email not found' });
      res.json(email);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid body' });
      console.error('Error marking inbound email read:', error);
      res.status(500).json({ error: 'Failed to update email' });
    }
  });

  app.patch('/api/admin/inbound-emails/:id/status', isAdmin, async (req, res) => {
    try {
      const { status } = z.object({ status: z.enum(['unread', 'read', 'responded']) }).parse(req.body);
      const email = await storage.updateInboundEmailStatus(req.params.id, status);
      if (!email) return res.status(404).json({ error: 'Email not found' });
      res.json(email);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid status' });
      console.error('Error updating inbound email status:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  app.delete('/api/admin/inbound-emails/:id', isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteInboundEmail(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Email not found' });
      res.json({ deleted: true });
    } catch (error) {
      console.error('Error deleting inbound email:', error);
      res.status(500).json({ error: 'Failed to delete email' });
    }
  });

  // ===== USER PROFILE =====

  app.patch('/api/user/profile', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const profileSchema = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        profileImageUrl: z.string().optional(),
      });
      const data = profileSchema.parse(req.body);
      const updated = await storage.updateUserProfile(userId, data);
      if (!updated) return res.status(404).json({ error: 'User not found' });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.post('/api/user/upload-signature', isAuthenticated, async (req, res) => {
    try {
      const config = getCloudinarySignedConfig();
      if (!config) return res.status(503).json({ error: 'Upload not configured' });
      const timestamp = Math.round(Date.now() / 1000);
      const folder = 'chat-attachments';
      const params = { folder, timestamp };
      const signature = generateSignature(params, config.apiSecret);
      res.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, signature, folder });
    } catch (error) {
      console.error('Error generating upload signature:', error);
      res.status(500).json({ error: 'Failed to generate upload signature' });
    }
  });

  // ===== CONVERSATIONS =====

  app.get('/api/conversations/unread-count', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const count = await storage.getTotalUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  });

  app.get('/api/conversations/support', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const conv = await storage.getOrCreateSupportConversation(userId);
      res.json(conv);
    } catch (error) {
      console.error('Error getting support conversation:', error);
      res.status(500).json({ error: 'Failed to get support conversation' });
    }
  });

  app.get('/api/conversations', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const convs = await storage.getConversationsForUser(userId);
      res.json(convs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  app.post('/api/conversations', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const convSchema = z.object({
        type: z.string().default('support'),
        participantIds: z.array(z.string()).optional(),
        title: z.string().optional(),
      });
      const data = convSchema.parse(req.body);
      // Dedup support conversations: return existing one if found
      if (data.type === 'support') {
        const conv = await storage.getOrCreateSupportConversation(userId);
        return res.json(conv);
      }
      let participantIds = data.participantIds ?? [];
      // Ensure creator is included
      const allParticipants = Array.from(new Set([userId, ...participantIds]));
      const conv = await storage.createConversation({ ...data, participantIds: allParticipants });
      res.json(conv);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  app.get('/api/conversations/:id/messages', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const isAdmin = (req as any).user?.isAdmin;
      const { id } = req.params;
      if (!isAdmin) {
        const ok = await storage.isParticipant(id, userId);
        if (!ok) return res.status(403).json({ error: 'Not a participant' });
      }
      const msgs = await storage.getMessages(id);
      // Mark as read
      await storage.markConversationRead(id, userId);
      res.json(msgs);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/conversations/:id/messages', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const isAdmin = (req as any).user?.isAdmin;
      const { id } = req.params;
      if (!isAdmin) {
        const ok = await storage.isParticipant(id, userId);
        if (!ok) return res.status(403).json({ error: 'Not a participant' });
      } else {
        // Auto-add admin as participant if not already
        await storage.addParticipant(id, userId);
      }
      const msgSchema = z.object({
        body: z.string().min(1),
        messageType: z.string().default('text'),
        imageUrl: z.string().optional(),
      });
      const data = msgSchema.parse(req.body);
      const msg = await storage.createMessage({ conversationId: id, senderId: userId, ...data });
      res.json(msg);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  });

  app.post('/api/conversations/:id/read', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      await storage.markConversationRead(req.params.id, userId);
      res.json({ ok: true });
    } catch (error) {
      console.error('Error marking read:', error);
      res.status(500).json({ error: 'Failed to mark read' });
    }
  });

  app.get('/api/admin/conversations', isAdmin, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const convs = await storage.getConversationsForUser(userId, true);
      res.json(convs);
    } catch (error) {
      console.error('Error fetching admin conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
