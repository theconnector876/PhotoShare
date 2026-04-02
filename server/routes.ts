import type { Express } from "express";
import { Client as PgClient } from "pg";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import webpush from "web-push";
import { setupPasswordAuth, hashPassword } from "./auth";
import { getSession } from "./session";
import passport from "passport";
import { insertBookingSchema, insertGallerySchema, insertContactMessageSchema, insertCatalogueSchema, insertReviewSchema, insertUserSchema, insertCouponSchema, insertBlogPostSchema, type Coupon } from "@shared/schema";
import { defaultPricingConfig } from "@shared/pricing";
import { defaultSiteConfig } from "@shared/site-config";
import { z } from "zod";
import { sendBookingReceived, sendBookingConfirmation, sendPaymentConfirmation, sendPasswordReset, sendPhotographerApproved, sendPhotographerRejected, sendAdminEmail, sendInboundEmailNotification } from "./email";
import { getCloudinarySignedConfig, generateSignature, generateR2PresignedPut } from "./upload";
import { v2 as cloudinary } from "cloudinary";

const wipayEnabled = Boolean(
  process.env.WIPAY_ACCOUNT_NUMBER &&
  process.env.WIPAY_API_KEY
);

const WIPAY_BASE_URL = 'https://jm.wipayfinancial.com/plugins/payments/request';
const WIPAY_ENVIRONMENT = process.env.WIPAY_ENVIRONMENT || 'live';
const WIPAY_FEE_STRUCTURE = process.env.WIPAY_FEE_STRUCTURE || 'merchant_absorb';

// ── Web Push ─────────────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@connectagrapher.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPushToUsers(userIds: string[], payload: { title: string; body: string; url?: string }) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  try {
    const subs = await storage.getPushSubscriptionsForUsers(userIds);
    await Promise.allSettled(subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch(async (err: any) => {
        // 410 Gone means subscription expired — remove it
        if (err.statusCode === 410) await storage.deletePushSubscription(sub.endpoint);
      })
    ));
  } catch (err) {
    console.error('Push send error:', err);
  }
}

// ── Exchange Rate Cache ──────────────────────────────────────────────────────
// Fetches live USD-based rates from open.er-api.com; falls back to admin config.
let _rateCache: { rates: Record<string, number>; fetchedAt: number } | null = null;
const RATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (_rateCache && (now - _rateCache.fetchedAt) < RATE_CACHE_TTL) return _rateCache.rates;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    if (r.ok) {
      const d = await r.json() as any;
      const rates = { JMD: d.rates.JMD, GBP: d.rates.GBP, CAD: d.rates.CAD, EUR: d.rates.EUR };
      _rateCache = { rates, fetchedAt: now };
      return rates;
    }
  } catch (e) {
    console.warn('[exchange-rates] live fetch failed:', (e as any).message);
  }
  // Fallback: admin-configured rates stored in siteConfigs
  try {
    const row = await storage.getSiteConfig('exchange_rates');
    if (row?.config) {
      const rates = row.config as Record<string, number>;
      _rateCache = { rates, fetchedAt: now };
      return rates;
    }
  } catch {}
  return { JMD: 157, GBP: 0.79, CAD: 1.36, EUR: 0.92 };
}

// Creates a WiPay checkout and returns the redirect URL
async function createWiPayCheckout(params: {
  bookingId: string;
  paymentType: 'deposit' | 'balance';
  amountJmd: number;
  email: string;
  name: string;
  phone: string;
  responseUrl: string;
}): Promise<string> {
  // Append a short random suffix so each attempt gets a unique order_id —
  // WiPay rejects duplicate order IDs from previous (cancelled/failed) attempts.
  const suffix = Math.random().toString(36).slice(2, 8);
  const orderId = `${params.bookingId}_${params.paymentType}_${suffix}`;
  const totalStr = params.amountJmd.toFixed(2);
  const body = new URLSearchParams({
    account_number: process.env.WIPAY_ACCOUNT_NUMBER!,
    currency: 'JMD',
    environment: WIPAY_ENVIRONMENT,
    fee_structure: WIPAY_FEE_STRUCTURE,
    method: 'credit_card',
    order_id: orderId,
    origin: 'ConnectAGrapher',
    total: totalStr,
    email: params.email,
    name: params.name,
    avs: '0',
    data: JSON.stringify({ booking_id: params.bookingId, payment_type: params.paymentType }),
    response_url: params.responseUrl,
    phone: params.phone || '',
    country_code: 'JM',
  });

  console.log('[wipay] Creating checkout:', { orderId, total: totalStr, env: WIPAY_ENVIRONMENT });

  const response = await fetch(WIPAY_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  console.log('[wipay] Checkout response status:', response.status, 'body:', rawText.slice(0, 500));

  let result: any;
  try {
    result = JSON.parse(rawText);
  } catch {
    throw new Error(`WiPay returned non-JSON (${response.status}): ${rawText.slice(0, 200)}`);
  }

  if (!result.url) {
    throw new Error(result.message || result.error || `WiPay did not return a checkout URL: ${JSON.stringify(result)}`);
  }
  return result.url;
}

// Booking with user account creation schema
// password/confirmPassword are optional — only required when creating a NEW user
const bookingWithAccountSchema = insertBookingSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  confirmPassword: z.string().optional(),
  couponCode: z.string().optional(),
  customPackageId: z.string().optional(),
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
  app.get('/api/version', (_req, res) => res.json({ v: 7, schema: 'wipay' }));

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
        profileImageUrl: photographer.profileImageUrl,
        bio: profile?.bio || null,
        location: profile?.location || null,
        specialties: profile?.specialties || [],
        portfolioLinks: profile?.portfolioLinks || [],
        availability: profile?.availability || null,
        socials: profile?.socials || {},
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
      const { password: validatedPassword, confirmPassword: validatedConfirmPassword, customPackageId, ...bookingData } = validatedData;

      // If a custom package is specified, override price/serviceType from the package
      let customPkgDepositAmount: number | null = null;
      if (customPackageId) {
        const pkg = await storage.getCustomPackageById(customPackageId);
        if (!pkg || !pkg.isActive) {
          return res.status(400).json({ error: 'Custom package not found or inactive' });
        }
        bookingData.totalPrice = pkg.totalPrice;
        bookingData.serviceType = pkg.serviceType;
        bookingData.currency = pkg.currency || 'USD';
        bookingData.packageType = 'custom';
        if (pkg.depositAmount > 0) customPkgDepositAmount = pkg.depositAmount;
      }
      
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

      // Use custom package deposit if set, otherwise 50% split
      const depositAmount = customPkgDepositAmount ?? Math.round(discountedTotal * 0.5);
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

      // Auto-create booking conversation when photographer is selected at booking time
      if (bookingData.photographerId && user) {
        try {
          const allUsers = await storage.getAllUsers();
          const adminIds = allUsers.filter(u => u.isAdmin).map(u => u.id);
          const memberIds = [...new Set([user.id, bookingData.photographerId])];
          const conv = await storage.createConversation({
            type: 'booking',
            bookingId: booking.id,
            title: `Booking: ${booking.clientName} – ${booking.serviceType}`,
            participantIds: memberIds,
            observerIds: adminIds,
          });
          await storage.createMessage({
            conversationId: conv.id,
            senderId: null,
            messageType: 'system',
            body: `Your booking is confirmed. Use this chat to coordinate details with your photographer.`,
          });
        } catch (convErr) {
          console.error('Failed to auto-create booking conversation:', convErr);
        }
      }

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
  // Check gallery access settings by share ID (before requiring credentials)
  app.get("/api/gallery/info/:id", async (req, res) => {
    try {
      const gallery = await storage.getGalleryById(req.params.id);
      if (!gallery || !gallery.shareEnabled) return res.status(404).json({ error: "Gallery not found" });
      res.json({ id: gallery.id, requireAccessCode: gallery.requireAccessCode, requireEmail: gallery.requireEmail, shareEnabled: gallery.shareEnabled });
    } catch { res.status(500).json({ error: "Failed to fetch gallery info" }); }
  });

  app.post("/api/gallery/access", async (req, res) => {
    try {
      const { email, accessCode, galleryId } = req.body;
      let gallery;
      if (galleryId) {
        gallery = await storage.getGalleryById(galleryId);
        if (!gallery || !gallery.shareEnabled) return res.status(404).json({ error: "Gallery not found" });
        if (gallery.requireAccessCode && gallery.accessCode !== accessCode) return res.status(401).json({ error: "Invalid access code" });
        if (gallery.requireEmail && !email) return res.status(400).json({ error: "Email required" });
      } else {
        gallery = await storage.getGalleryByAccess(email, accessCode);
        if (!gallery) return res.status(404).json({ error: "Gallery not found or invalid access code" });
      }
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || null;
      storage.logGalleryAccess(gallery.id, email || null, ip, req.headers['user-agent'] || null).catch(() => {});

      // Pre-generate Cloudinary archive URLs synchronously — no extra DB or network call needed.
      // These are stored client-side so button clicks open the URL immediately (no server round-trip).
      const downloadUrls: Record<string, string> = {};
      try {
        const cfg = getCloudinarySignedConfig();
        if (cfg) {
          cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret });

          const galleryImages: string[] = gallery.galleryImages || [];
          if (gallery.galleryDownloadEnabled && galleryImages.length > 0 && galleryImages.every((u: string) => u.includes('res.cloudinary.com'))) {
            downloadUrls.gallery = (cloudinary.utils as any).download_zip_url({
              prefixes: [`galleries/${gallery.id}`],
              resource_type: 'image',
            });
          }

          const emailSels: Record<string, string[]> = gallery.emailSelections || {};
          const resolvedSelected: string[] = (email && emailSels[email]) ? emailSels[email] : (gallery.selectedImages || []);
          if (gallery.selectedDownloadEnabled && resolvedSelected.length > 0 && resolvedSelected.every((u: string) => u.includes('res.cloudinary.com'))) {
            const publicIds = resolvedSelected.map((url: string) => {
              const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
              return m ? m[1] : url;
            });
            downloadUrls.selected = (cloudinary.utils as any).download_zip_url({ public_ids: publicIds, resource_type: 'image' });
          }

          const finalImages: string[] = gallery.finalImages || [];
          if (gallery.finalDownloadEnabled && finalImages.length > 0 && finalImages.every((u: string) => u.includes('res.cloudinary.com'))) {
            const publicIds = finalImages.map((url: string) => {
              const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
              return m ? m[1] : url;
            });
            downloadUrls.final = (cloudinary.utils as any).download_zip_url({ public_ids: publicIds, resource_type: 'image' });
          }
        }
      } catch (e) {
        console.warn('[gallery/access] download URL pre-gen failed:', (e as any).message);
      }

      res.json({ ...gallery, downloadUrls });
    } catch (error) {
      res.status(500).json({ error: "Failed to access gallery" });
    }
  });

  app.post("/api/gallery/:id/log-download", async (req, res) => {
    try {
      const { email, imageUrl, downloadType } = z.object({ email: z.string().optional(), imageUrl: z.string(), downloadType: z.enum(['single','bulk']).default('single') }).parse(req.body);
      await storage.logGalleryDownload(req.params.id, email || null, imageUrl, downloadType);
      res.json({ ok: true });
    } catch { res.status(400).json({ error: 'Invalid data' }); }
  });

  app.post("/api/gallery/:id/like", async (req, res) => {
    try {
      const { email, imageUrl } = z.object({ email: z.string().email(), imageUrl: z.string() }).parse(req.body);
      const result = await storage.toggleGalleryLike(req.params.id, email, imageUrl);
      res.json(result);
    } catch { res.status(400).json({ error: 'Invalid data' }); }
  });

  app.get("/api/gallery/:id/likes", async (req, res) => {
    try {
      const likes = await storage.getGalleryLikes(req.params.id);
      const counts: Record<string, number> = {};
      for (const l of likes) { counts[l.imageUrl] = (counts[l.imageUrl] || 0) + 1; }
      const email = req.query.email as string | undefined;
      const likedByMe = email ? likes.filter(l => l.email === email).map(l => l.imageUrl) : [];
      res.json({ counts, likedByMe });
    } catch { res.status(500).json({ error: 'Failed to fetch likes' }); }
  });

  // Client gallery selection update (public, authenticated by gallery ownership via email+code)
  app.patch("/api/gallery/:id/images", async (req, res) => {
    try {
      const { id } = req.params;
      const { images, type, email } = req.body;
      if (!["gallery", "selected", "final"].includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
      }
      if (type !== "selected") {
        return res.status(403).json({ error: "Clients can only update selected images" });
      }
      const gallery = await storage.getGalleryById(id);
      if (!gallery) return res.status(404).json({ error: "Gallery not found" });
      // Save per-email selection (and merge into selectedImages)
      const updated = email
        ? await storage.updateEmailSelections(id, email, images)
        : await storage.updateGalleryImages(id, images, type);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update gallery" });
    }
  });

  // Resolve which images to zip based on type/email
  // Handles both camelCase (Drizzle) and snake_case (raw pg) field names
  function resolveImages(gallery: any, type: string, email: string, overrideImages?: string[]): string[] {
    if (overrideImages && overrideImages.length > 0) return overrideImages;
    if (type === 'gallery') return gallery.galleryImages || gallery.gallery_images || [];
    if (type === 'selected') {
      const emailSels = (gallery.emailSelections || gallery.email_selections || {}) as Record<string, string[]>;
      const selected = gallery.selectedImages || gallery.selected_images || [];
      return email && emailSels[email] ? emailSels[email] : selected;
    }
    return gallery.finalImages || gallery.final_images || [];
  }

  async function buildZipUrl(res: any, gallery: any, type: string, email: string, overrideImages?: string[]) {
    const images = resolveImages(gallery, type, email, overrideImages);
    if (images.length === 0) return res.status(400).json({ error: 'No images to download' });

    const allCloudinary = images.every((u: string) => u.includes('res.cloudinary.com'));
    const galleryId = gallery.id;

    if (allCloudinary) {
      // Cloudinary images: generate a signed archive URL (no server-side fetching)
      const cfg = getCloudinarySignedConfig();
      if (!cfg) return res.status(500).json({ error: 'Not configured' });
      cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret });

      let archiveUrl: string;
      if (type === 'gallery') {
        // Folder prefix — short URL regardless of image count
        archiveUrl = (cloudinary.utils as any).download_zip_url({
          prefixes: [`galleries/${galleryId}`],
          resource_type: 'image',
        });
      } else {
        // Selected/final — public_ids (smaller sets, URL stays under limit)
        const publicIds = images.map((url: string) => {
          const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
          return m ? m[1] : url;
        });
        archiveUrl = (cloudinary.utils as any).download_zip_url({
          public_ids: publicIds,
          resource_type: 'image',
        });
      }
      return res.redirect(archiveUrl);
    }

    // R2 or other: server-side zip (fast, zero egress)
    const JSZip = require('jszip');
    const zip = new JSZip();
    await Promise.all(images.map(async (url: string, i: number) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        const buf = Buffer.from(await r.arrayBuffer());
        const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
        zip.file(`photo-${String(i + 1).padStart(3, '0')}.${ext}`, buf);
      } catch { /* skip */ }
    }));
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-photos.zip"`);
    res.setHeader('Content-Length', zipBuf.length);
    res.send(zipBuf);
  }

  // Use pg.Client (TCP) for gallery lookup to avoid NeonPool WebSocket cold-start hang
  async function getGalleryDirect(id: string) {
    const client = new PgClient({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    const { rows } = await client.query('SELECT * FROM galleries WHERE id = $1 LIMIT 1', [id]);
    await client.end();
    return rows[0] || null;
  }

  app.get("/api/gallery/:id/download-zip", async (req, res) => {
    try {
      const { type = 'final', email = '', code } = req.query as Record<string, string>;
      const gallery = await getGalleryDirect(req.params.id);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      if (gallery.require_access_code && gallery.access_code !== code) {
        return res.status(401).json({ error: 'Invalid access code' });
      }
      await buildZipUrl(res, gallery, type, email);
    } catch (error: any) {
      if (!res.headersSent) res.status(500).json({ error: 'Download failed', details: error?.message });
    }
  });

  app.post("/api/gallery/:id/download-zip", async (req, res) => {
    try {
      const { type = 'final', email = '', code, images: imagesRaw } = req.body as { type?: string; email?: string; code?: string; images?: string | string[] };
      const gallery = await getGalleryDirect(req.params.id);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      if (gallery.require_access_code && gallery.access_code !== code) {
        return res.status(401).json({ error: 'Invalid access code' });
      }
      let overrideImages: string[] | undefined;
      if (imagesRaw) {
        overrideImages = typeof imagesRaw === 'string' ? JSON.parse(imagesRaw) : imagesRaw;
      }
      await buildZipUrl(res, gallery, type, email, overrideImages);
    } catch (error: any) {
      if (!res.headersSent) res.status(500).json({ error: 'Download failed', details: error?.message });
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
            // Auto-post review request widget when booking is completed
            if (validatedData.status === 'completed' && booking) {
              await storage.createMessage({
                conversationId: conv.id,
                senderId: null,
                messageType: 'review_request',
                body: JSON.stringify({
                  bookingId: id,
                  title: `${booking.clientName} – ${booking.serviceType}`,
                }),
              });
            }
            // Push notification to participants
            const participantIds = await storage.getConversationParticipantIds(conv.id);
            sendPushToUsers(participantIds, {
              title: `Booking ${validatedData.status}`,
              body: `Your booking for ${booking?.serviceType || 'your session'} has been ${statusText}.`,
              url: '/dashboard',
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

  // Create a standalone gallery (not tied to a booking)
  app.post('/api/admin/galleries', isAdmin, async (req, res) => {
    try {
      const gallerySchema = z.object({
        clientEmail: z.string().min(1),
        accessCode: z.string().min(1).optional(),
      });
      const { clientEmail, accessCode } = gallerySchema.parse(req.body);
      const code = accessCode || Math.random().toString(36).substr(2, 8).toUpperCase();
      // Use a fresh pg.Client (standard TCP/SSL) to avoid NeonPool WebSocket cold-start hangs
      const client = new PgClient({ connectionString: process.env.DATABASE_URL!.trim() });
      await client.connect();
      const { rows } = await client.query(
        `INSERT INTO galleries (client_email, access_code, gallery_images, selected_images, final_images)
         VALUES ($1, $2, ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]) RETURNING *`,
        [clientEmail, code]
      );
      await client.end();
      res.json(rows[0]);
    } catch (error: any) {
      console.error('Error creating gallery:', error);
      res.status(400).json({ error: 'Failed to create gallery', details: error?.message });
    }
  });

  // Delete a gallery
  app.delete('/api/admin/gallery/:id', isAdmin, async (req, res) => {
    try {
      await storage.deleteGallery(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting gallery:', error);
      res.status(500).json({ error: 'Failed to delete gallery' });
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
    const { galleryId } = req.body || {};
    const params: Record<string, string | number> = { timestamp };
    if (galleryId) {
      params.folder = `galleries/${galleryId}`;
      params.use_filename = 'true';
      params.unique_filename = 'false';
    }
    const signature = generateSignature(params, config.apiSecret);
    res.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, signature,
      ...(galleryId ? { folder: `galleries/${galleryId}`, useFilename: true, uniqueFilename: false } : {}) });
  });

  // R2 presigned PUT URL for browser-direct upload
  app.post('/api/admin/upload-r2-url', isAdmin, async (req, res) => {
    try {
      const { filename, contentType, galleryId } = req.body as { filename: string; contentType: string; galleryId?: string };
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = galleryId
        ? `galleries/${galleryId}/${Date.now()}-${safeName}`
        : `uploads/${Date.now()}-${safeName}`;
      const result = await generateR2PresignedPut(key, contentType || 'image/jpeg');
      if (!result) return res.status(503).json({ error: 'R2 storage not configured' });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update gallery settings (download toggles, status, watermark)
  app.patch('/api/admin/gallery/:id/settings', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        galleryDownloadEnabled: z.boolean().optional(),
        selectedDownloadEnabled: z.boolean().optional(),
        finalDownloadEnabled: z.boolean().optional(),
        status: z.enum(['pending', 'active', 'selection', 'editing', 'completed']).optional(),
        watermarkSettings: z.record(z.any()).optional(),
        requireAccessCode: z.boolean().optional(),
        requireEmail: z.boolean().optional(),
        shareEnabled: z.boolean().optional(),
      });
      const settings = schema.parse(req.body);
      const gallery = await storage.updateGallerySettings(req.params.id, settings);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      res.json(gallery);
    } catch (error) {
      res.status(400).json({ error: 'Invalid settings' });
    }
  });

  app.get('/api/admin/gallery/:id/logs', isAdmin, async (req, res) => {
    try {
      const [accessLogs, downloadLogs, likes] = await Promise.all([
        storage.getGalleryAccessLogs(req.params.id),
        storage.getGalleryDownloadLogs(req.params.id),
        storage.getGalleryLikes(req.params.id),
      ]);
      res.json({ accessLogs, downloadLogs, likes });
    } catch { res.status(500).json({ error: 'Failed to fetch logs' }); }
  });

  // Photographer gallery settings
  app.patch('/api/photographer/gallery/:id/settings', isPhotographerApproved, async (req, res) => {
    try {
      const schema = z.object({
        galleryDownloadEnabled: z.boolean().optional(),
        selectedDownloadEnabled: z.boolean().optional(),
        finalDownloadEnabled: z.boolean().optional(),
        status: z.enum(['pending', 'active', 'selection', 'editing', 'completed']).optional(),
        watermarkSettings: z.record(z.any()).optional(),
        requireAccessCode: z.boolean().optional(),
        requireEmail: z.boolean().optional(),
        shareEnabled: z.boolean().optional(),
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

  app.get('/api/photographer/gallery/:id/logs', isPhotographerApproved, async (req, res) => {
    try {
      const gallery = await storage.getGalleryById(req.params.id);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      const userId = (req as any).user?.id;
      if (gallery.bookingId) {
        const booking = await storage.getBooking(gallery.bookingId);
        if (!booking || booking.photographerId !== userId) return res.status(403).json({ error: 'Not assigned to this gallery' });
      }
      const [accessLogs, downloadLogs, likes] = await Promise.all([
        storage.getGalleryAccessLogs(req.params.id),
        storage.getGalleryDownloadLogs(req.params.id),
        storage.getGalleryLikes(req.params.id),
      ]);
      res.json({ accessLogs, downloadLogs, likes });
    } catch { res.status(500).json({ error: 'Failed to fetch logs' }); }
  });

  // Admin: update image folder mapping
  app.patch('/api/admin/gallery/:id/folders', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { folders } = req.body; // { gallery: { "Reception": ["url1"] }, final: {...} }
      if (!folders || typeof folders !== 'object') return res.status(400).json({ error: 'folders object required' });
      const gallery = await storage.getGalleryById(req.params.id);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      const updated = await storage.updateGallery(gallery.id, { imageFolders: folders });
      res.json(updated);
    } catch (error) {
      console.error('Error updating gallery folders:', error);
      res.status(500).json({ error: 'Failed to update folders' });
    }
  });

  // Photographer: update image folder mapping
  app.patch('/api/photographer/gallery/:id/folders', isAuthenticated, isPhotographerApproved, async (req, res) => {
    try {
      const { folders } = req.body;
      if (!folders || typeof folders !== 'object') return res.status(400).json({ error: 'folders object required' });
      const gallery = await storage.getGalleryById(req.params.id);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      const updated = await storage.updateGallery(gallery.id, { imageFolders: folders });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update folders' });
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
    const { galleryId } = req.body || {};
    const params: Record<string, string | number> = { timestamp };
    if (galleryId) {
      params.folder = `galleries/${galleryId}`;
      params.use_filename = 'true';
      params.unique_filename = 'false';
    }
    const signature = generateSignature(params, config.apiSecret);
    res.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, signature,
      ...(galleryId ? { folder: `galleries/${galleryId}`, useFilename: true, uniqueFilename: false } : {}) });
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

  // WiPay payment routes
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      if (!wipayEnabled) {
        return res.status(501).json({ error: "Payments not configured" });
      }

      const { bookingId, paymentType, tipAmount: rawTip } = req.body;
      const tipAmount = typeof rawTip === 'number' ? Math.max(0, rawTip) : 0;

      if (!bookingId || !paymentType || !['deposit', 'balance'].includes(paymentType)) {
        return res.status(400).json({ error: 'Missing or invalid payment data' });
      }

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const allowedForDeposit = ['confirmed', 'pending'].includes(booking.status);
      const allowedForBalance = ['confirmed', 'pending', 'completed'].includes(booking.status);
      if (paymentType === 'deposit' && !allowedForDeposit) {
        return res.status(400).json({ error: 'Booking must be confirmed or pending to pay deposit' });
      }
      if (paymentType === 'balance' && !allowedForBalance) {
        return res.status(400).json({ error: 'Booking must be confirmed, pending, or completed to pay balance' });
      }

      const serverDepositAmount = Math.round(booking.totalPrice * 0.5);
      const serverBalanceDue = booking.totalPrice - serverDepositAmount;

      let baseAmount: number;
      if (paymentType === 'deposit') {
        if (booking.depositPaid) return res.status(400).json({ error: 'Deposit already paid' });
        baseAmount = serverDepositAmount;
      } else {
        if (!booking.depositPaid) {
          if (serverDepositAmount === 0) {
            // Coupon/free booking — deposit was never charged, auto-mark it now
            await storage.updateBookingPaymentStatus(bookingId, 'deposit');
            if (booking.status === 'pending') {
              await storage.updateBookingStatus(bookingId, 'confirmed');
            }
          } else {
            return res.status(400).json({ error: 'Deposit must be paid first' });
          }
        }
        // Only block if there's an actual balance owed — zero-balance (coupon) bookings allow tip-only payments
        if (booking.balancePaid && serverBalanceDue > 0) return res.status(400).json({ error: 'Balance already paid' });
        baseAmount = serverBalanceDue;
      }

      const amount = baseAmount + (paymentType === 'balance' ? tipAmount : 0);

      // If nothing to charge (e.g. coupon covered everything and no tip), auto-mark as paid
      if (amount === 0) {
        await storage.updateBookingPaymentStatus(bookingId, paymentType);
        if (paymentType === 'deposit' && booking.status === 'pending') {
          await storage.updateBookingStatus(bookingId, 'confirmed');
        }
        console.log(`[wipay] Auto-marked ${paymentType} paid for booking ${bookingId} (zero amount)`);
        return res.json({ autoMarked: true, redirectUrl: `/payment-success?booking=${bookingId}&type=${paymentType}` });
      }

      // Convert to JMD for WiPay (JM processor)
      const bookingCurrency = (booking as any).currency || 'USD';
      const rates = await fetchExchangeRates();
      const jmdRate = (rates.JMD as number) ?? 157;
      const amountJmd = bookingCurrency === 'JMD' ? amount : Math.round(amount * jmdRate);

      const appUrl = process.env.APP_URL || 'https://www.connectagrapher.com';
      const checkoutUrl = await createWiPayCheckout({
        bookingId,
        paymentType,
        amountJmd,
        email: booking.email,
        name: booking.clientName,
        phone: (booking as any).contactNumber || '',
        responseUrl: `${appUrl}/api/wipay/callback`,
      });

      res.json({ checkoutUrl });
    } catch (error: any) {
      console.error('Error creating WiPay checkout:', error);
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
        currency: (booking as any).currency || 'USD',
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

  // WiPay callback — WiPay POSTs here after payment completes
  app.all('/api/wipay/callback', async (req: any, res: any) => {
    // WiPay sends params as POST body (application/x-www-form-urlencoded) or query string
    const params = { ...req.query, ...req.body } as Record<string, string>;
    const { status, transaction_id, order_id, hash } = params;
    console.log('[wipay callback] received:', { status, transaction_id, order_id, hash: hash?.slice(0, 8) + '...' });

    const fail = (reason: string) => {
      console.error('[wipay callback]', reason, params);
      return res.redirect(302, '/dashboard');
    };

    try {
      if (!order_id) return fail('Missing order_id');

      // order_id format: {bookingId}_{paymentType} (legacy) or {bookingId}_{paymentType}_{suffix} (current)
      // Find the segment that is 'deposit' or 'balance' — everything before it is the bookingId.
      const segments = order_id.split('_');
      let paymentType = '';
      let bookingId = '';
      for (let i = segments.length - 1; i >= 0; i--) {
        if (['deposit', 'balance'].includes(segments[i])) {
          paymentType = segments[i];
          bookingId = segments.slice(0, i).join('_');
          break;
        }
      }
      if (!paymentType || !bookingId) return fail('Invalid order_id format');

      const booking = await storage.getBooking(bookingId);
      if (!booking) return fail(`Booking not found: ${bookingId}`);

      // Idempotency: skip if already paid
      if (paymentType === 'deposit' && booking.depositPaid) {
        return res.redirect(302, `/payment-success?booking=${bookingId}&type=${paymentType}`);
      }
      if (paymentType === 'balance' && booking.balancePaid) {
        return res.redirect(302, `/payment-success?booking=${bookingId}&type=${paymentType}`);
      }

      if (status !== 'success') {
        console.warn(`[wipay callback] Payment not successful: status=${status} booking=${bookingId}`);
        return res.redirect(302, `/payment?booking=${bookingId}&type=${paymentType}&error=payment_failed`);
      }

      // Verify WiPay hash: md5(transaction_id + total + api_key)
      // Use WiPay-returned total when present (handles tips / coupon scenarios).
      // Fall back to computing from booking if total not in params.
      let verifyTotal: string;
      if (params.total) {
        verifyTotal = parseFloat(params.total).toFixed(2);
      } else {
        const bookingCurrency = (booking as any).currency || 'USD';
        const rates = await fetchExchangeRates();
        const jmdRate = (rates.JMD as number) ?? 157;
        const serverDeposit = Math.round(booking.totalPrice * 0.5);
        const serverBalance = booking.totalPrice - serverDeposit;
        const baseAmount = paymentType === 'deposit' ? serverDeposit : serverBalance;
        const amountJmd = bookingCurrency === 'JMD' ? baseAmount : Math.round(baseAmount * jmdRate);
        verifyTotal = amountJmd.toFixed(2);
      }

      const crypto = require('crypto');
      const expectedHash = crypto
        .createHash('md5')
        .update(`${transaction_id}${verifyTotal}${process.env.WIPAY_API_KEY}`)
        .digest('hex');

      if (hash !== expectedHash) {
        console.error(`[wipay callback] Hash mismatch for booking ${bookingId}. Expected ${expectedHash}, got ${hash}`);
        return fail('Hash verification failed');
      }

      // Record transaction and mark paid
      await storage.updateBookingTransactionId(bookingId, transaction_id, paymentType);
      await storage.updateBookingPaymentStatus(bookingId, paymentType);
      console.log(`[wipay] Payment ${paymentType} confirmed for booking ${bookingId} (txn ${transaction_id})`);

      // Send confirmation email (non-blocking)
      const paidBooking = await storage.getBooking(bookingId);
      if (paidBooking) {
        const amount = paymentType === 'deposit'
          ? Math.round(paidBooking.totalPrice * 0.5)
          : paidBooking.totalPrice - Math.round(paidBooking.totalPrice * 0.5);
        sendPaymentConfirmation({
          clientName: paidBooking.clientName,
          email: paidBooking.email,
          serviceType: paidBooking.serviceType,
          id: paidBooking.id,
        }, paymentType, amount).catch(err => console.error('Failed to send payment confirmation email:', err));
      }

      return res.redirect(302, `/payment-success?booking=${bookingId}&type=${paymentType}`);
    } catch (error: any) {
      console.error('[wipay callback] Unexpected error:', error);
      return res.redirect(302, '/dashboard');
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
      const { serviceType, photographerId } = req.query;
      let cats;

      if (photographerId && typeof photographerId === 'string') {
        cats = await storage.getCataloguesByPhotographerId(photographerId);
        cats = cats.filter(c => c.isPublished);
      } else if (serviceType && typeof serviceType === 'string') {
        cats = await storage.getCataloguesByServiceType(serviceType);
      } else {
        cats = await storage.getPublishedCatalogues();
      }

      res.json(cats.map(createSafeCatalogueDTO));
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
      const approve = req.body?.approve !== false; // default true
      const review = await storage.approveReview(req.params.id, approve);
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

  // Get single user profile (admin only)
  app.get('/api/admin/users/:id', isAdmin, async (req, res) => {
    try {
      const user = await storage.getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { password: _, ...safeUser } = user as any;
      const photographerProfile = user.role === 'photographer'
        ? await storage.getPhotographerProfileByUserId(user.id)
        : null;
      const bookingList = user.email
        ? await storage.getUserBookings(user.email)
        : [];
      res.json({ user: safeUser, photographerProfile, bookings: bookingList });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
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

  // ── Broadcast System ─────────────────────────────────────────────────────

  // Create a broadcast offer for a booking
  app.post('/api/admin/bookings/:id/broadcast', isAdmin, async (req, res) => {
    try {
      const bookingId = req.params.id;
      const { offerAmount, targetPhotographerIds, notes } = z.object({
        offerAmount: z.number().positive(),
        targetPhotographerIds: z.array(z.string()).default([]),
        notes: z.string().optional(),
      }).parse(req.body);

      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (!booking.depositPaid) return res.status(400).json({ error: 'Deposit must be paid before broadcasting' });
      if (booking.photographerId) return res.status(400).json({ error: 'Booking already has a photographer assigned' });

      // Cancel any existing open broadcast for this booking
      const existing = await storage.getBroadcastByBookingId(bookingId);
      if (existing) await storage.cancelBroadcast(existing.id);

      const adminId = (req as any).user?.id;
      const currency = (booking as any).currency || 'USD';

      const broadcast = await storage.createBroadcast({ bookingId, adminId, offerAmount, currency, targetPhotographerIds, notes });

      // Determine which photographers to notify
      let targetIds = targetPhotographerIds;
      if (!targetIds.length) {
        // All approved photographers
        const allPhotographers = await storage.getAllPhotographers();
        targetIds = allPhotographers
          .filter((p: any) => p.photographerStatus === 'approved')
          .map((p: any) => p.id);
      }

      await storage.createBroadcastResponses(broadcast.id, targetIds);

      // Email targeted photographers
      const allPhotographers = await storage.getAllPhotographers();
      const targets = allPhotographers.filter((p: any) => targetIds.includes(p.id));
      for (const photographer of targets) {
        if (photographer.email) {
          sendAdminEmail(
            photographer.email,
            (photographer.firstName || 'Photographer'),
            `New Job Offer – ${booking.serviceType} in ${booking.parish}`,
            `Hi ${photographer.firstName || 'there'},\n\nA new photography job is available and has been offered to you:\n\nService: ${booking.serviceType} – ${booking.packageType}\nDate: ${booking.shootDate} at ${booking.shootTime}\nLocation: ${booking.location}, ${booking.parish}\nOffer: ${currency} ${offerAmount}\n\n${notes ? `Note from admin: ${notes}\n\n` : ''}Log in to your dashboard to accept or decline this offer.\n\nhttps://www.connectagrapher.com/photographer-dashboard`
          ).catch(console.error);
        }
      }

      res.json({ broadcast, targetCount: targetIds.length });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data' });
      console.error('Error creating broadcast:', error);
      res.status(500).json({ error: 'Failed to create broadcast' });
    }
  });

  // Get broadcast status for a booking
  app.get('/api/admin/bookings/:id/broadcast', isAdmin, async (req, res) => {
    try {
      const broadcast = await storage.getBroadcastByBookingId(req.params.id);
      if (!broadcast) return res.json(null);
      const responses = await storage.getBroadcastResponses(broadcast.id);
      res.json({ broadcast, responses });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get broadcast' });
    }
  });

  // Raise (update) the offer amount on an open broadcast
  app.put('/api/admin/broadcasts/:id/offer', isAdmin, async (req, res) => {
    try {
      const { offerAmount } = z.object({ offerAmount: z.number().positive() }).parse(req.body);
      const broadcast = await storage.getBroadcast(req.params.id);
      if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
      if (broadcast.status !== 'open') return res.status(400).json({ error: 'Broadcast is not open' });

      const updated = await storage.updateBroadcastOffer(req.params.id, offerAmount);

      // Notify pending photographers of the raised offer
      const responses = await storage.getBroadcastResponses(req.params.id);
      const booking = await storage.getBooking(broadcast.bookingId);
      for (const r of responses.filter(r => r.response === 'pending' && r.photographer?.email)) {
        sendAdminEmail(
          r.photographer!.email!,
          r.photographer!.firstName || 'Photographer',
          `Updated Offer – ${booking?.serviceType} in ${booking?.parish}`,
          `Hi ${r.photographer!.firstName || 'there'},\n\nThe offer for the photography job you were invited to has been updated:\n\nNew Offer: ${broadcast.currency} ${offerAmount}\n\nLog in to your dashboard to accept or decline.\n\nhttps://www.connectagrapher.com/photographer-dashboard`
        ).catch(console.error);
      }

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data' });
      res.status(500).json({ error: 'Failed to update offer' });
    }
  });

  // Cancel a broadcast
  app.delete('/api/admin/broadcasts/:id', isAdmin, async (req, res) => {
    try {
      const broadcast = await storage.getBroadcast(req.params.id);
      if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
      await storage.cancelBroadcast(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to cancel broadcast' });
    }
  });

  // Get all open offers for the logged-in photographer
  app.get('/api/photographer/offers', isAuthenticated, async (req, res) => {
    try {
      const photographerId = (req as any).user?.id;
      const offers = await storage.getOpenBroadcastsForPhotographer(photographerId);
      res.json(offers);
    } catch (error) {
      console.error('Error fetching photographer offers:', error);
      res.status(500).json({ error: 'Failed to fetch offers' });
    }
  });

  // Accept an offer
  app.post('/api/photographer/offers/:id/accept', isAuthenticated, async (req, res) => {
    try {
      const photographerId = (req as any).user?.id;
      const broadcastId = req.params.id;

      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) return res.status(404).json({ error: 'Offer not found' });
      if (broadcast.status !== 'open') return res.status(400).json({ error: 'This offer is no longer available' });

      // Mark this photographer's response as accepted
      await storage.respondToBroadcast(broadcastId, photographerId, 'accepted');
      // Close other pending responses
      await storage.closeOtherBroadcastResponses(broadcastId, photographerId);
      // Mark broadcast as accepted
      await storage.acceptBroadcast(broadcastId, photographerId);
      // Assign photographer to booking
      await storage.assignBookingPhotographer(broadcast.bookingId, photographerId);

      // Create booking conversation if needed
      const booking = await storage.getBooking(broadcast.bookingId);
      if (booking) {
        const existing = await storage.getConversationByBookingId(broadcast.bookingId);
        if (!existing) {
          const admins = (await storage.getAllUsers()).filter((u: any) => u.isAdmin);
          const participantIds = [photographerId, ...admins.map((a: any) => a.id)];
          await storage.createConversation({ type: 'booking', bookingId: broadcast.bookingId, title: `Booking: ${booking.serviceType}`, participantIds });
        }
        // Email confirmation to photographer
        const photographer = await storage.getUser(photographerId);
        if (photographer?.email) {
          sendAdminEmail(
            photographer.email,
            photographer.firstName || 'Photographer',
            `Offer Accepted – ${booking.serviceType} on ${booking.shootDate}`,
            `You have successfully accepted the offer for:\n\nService: ${booking.serviceType} – ${booking.packageType}\nDate: ${booking.shootDate} at ${booking.shootTime}\nLocation: ${booking.location}, ${booking.parish}\nYour offer: ${broadcast.currency} ${broadcast.offerAmount}\n\nLog in to your dashboard to view full booking details.`
          ).catch(console.error);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error accepting offer:', error);
      res.status(500).json({ error: 'Failed to accept offer' });
    }
  });

  // Decline an offer
  app.post('/api/photographer/offers/:id/decline', isAuthenticated, async (req, res) => {
    try {
      const photographerId = (req as any).user?.id;
      await storage.respondToBroadcast(req.params.id, photographerId, 'declined');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to decline offer' });
    }
  });

  // ── End Broadcast System ──────────────────────────────────────────────────

  // Send payment link to client (admin only)
  app.post('/api/admin/bookings/:id/send-payment-link', isAdmin, async (req, res) => {
    try {
      if (!wipayEnabled) {
        return res.status(501).json({ error: 'Payments not configured' });
      }
      const { paymentType, sendEmail } = z.object({ paymentType: z.enum(['deposit', 'balance']), sendEmail: z.boolean().optional().default(false) }).parse(req.body);
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
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

      const bookingCurrency = (booking as any).currency || 'USD';
      const rates = await fetchExchangeRates();
      const jmdRate = (rates.JMD as number) ?? 157;
      const amountJmd = bookingCurrency === 'JMD' ? amount : Math.round(amount * jmdRate);
      const appUrl = process.env.APP_URL || 'https://www.connectagrapher.com';

      const url = await createWiPayCheckout({
        bookingId: booking.id,
        paymentType,
        amountJmd,
        email: booking.email,
        name: booking.clientName,
        phone: (booking as any).contactNumber || '',
        responseUrl: `${appUrl}/api/wipay/callback`,
      });

      if (sendEmail) {
        await sendAdminEmail(
          booking.email,
          booking.clientName,
          `Payment Link – ${paymentType === 'deposit' ? 'Deposit' : 'Balance'}`,
          `Hi ${booking.clientName},\n\nPlease use the following link to complete your ${paymentType} payment of $${amount.toFixed(2)}:\n\n${url}\n\nThank you!`
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
            ])];
            const photographer = await storage.getUser(photographerId);
            const conv = await storage.createConversation({
              type: 'booking',
              bookingId: booking.id,
              title: `Booking: ${booking.clientName} – ${booking.serviceType}`,
              participantIds,
              observerIds: adminIds,
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

  // Account deletion — required by Apple App Store
  app.delete('/api/user/account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      // Admins cannot self-delete via this endpoint
      if (req.user?.isAdmin) return res.status(403).json({ error: 'Admin accounts cannot be deleted this way' });
      await storage.deleteUser(userId);
      req.logout((err: any) => {
        if (err) console.error('Logout error after account deletion:', err);
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Failed to delete account' });
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
      const isAdminUser = (req as any).user?.isAdmin;
      const { id } = req.params;

      const role = await storage.getUserRoleInConversation(id, userId);
      // Admins can always send regardless of observer/participant status
      if (!isAdminUser) {
        if (role === 'observer') {
          return res.status(403).json({ error: 'View-only mode for this conversation.' });
        }
        if (!role) {
          return res.status(403).json({ error: 'Not a participant' });
        }
      }

      const msgSchema = z.object({
        body: z.string().min(1),
        messageType: z.string().default('text'),
        imageUrl: z.string().optional(),
      });
      const data = msgSchema.parse(req.body);
      const msg = await storage.createMessage({ conversationId: id, senderId: userId, ...data });
      res.json(msg);
      // Push notification: notify other participants (fire-and-forget)
      if (data.messageType === 'text' || data.messageType === 'image') {
        try {
          const sender = await storage.getUser(userId);
          const senderName = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email : 'Someone';
          const participantIds = await storage.getConversationParticipantIds(id);
          const otherIds = participantIds.filter(pid => pid !== userId);
          const notifBody = data.messageType === 'image' ? 'Sent an image' : (data.body.length > 80 ? data.body.slice(0, 80) + '…' : data.body);
          sendPushToUsers(otherIds, {
            title: `New message from ${senderName}`,
            body: notifBody,
            url: '/dashboard',
          });
        } catch { /* non-critical */ }
      }
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  });

  app.delete('/api/conversations/:id/messages/:msgId', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const isAdminUser = (req as any).user?.isAdmin;
      const deleted = await storage.deleteMessage(req.params.msgId, userId, isAdminUser);
      if (!deleted) return res.status(403).json({ error: 'Cannot delete this message' });
      res.json({ ok: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: 'Failed to delete message' });
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

  // Add participant to conversation (admin only)
  app.post('/api/conversations/:id/participants', isAdmin, async (req, res) => {
    try {
      const { userId: targetId } = z.object({ userId: z.string() }).parse(req.body);
      await storage.addParticipant(req.params.id, targetId, 'member');
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data' });
      console.error('Error adding participant:', error);
      res.status(500).json({ error: 'Failed to add participant' });
    }
  });

  // Remove participant from conversation (admin only)
  app.delete('/api/conversations/:id/participants/:userId', isAdmin, async (req, res) => {
    try {
      await storage.removeParticipant(req.params.id, req.params.userId);
      res.json({ ok: true });
    } catch (error) {
      console.error('Error removing participant:', error);
      res.status(500).json({ error: 'Failed to remove participant' });
    }
  });

  // Get gallery info linked to a conversation (for sharing widget)
  app.get('/api/conversations/:id/gallery', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const isUserAdmin = (req as any).user?.isAdmin;
      const convId = req.params.id;
      const isParticipant = await storage.isParticipant(convId, userId);
      if (!isParticipant && !isUserAdmin) return res.status(403).json({ error: 'Forbidden' });
      const conv = await storage.getConversation(convId);
      if (!conv?.bookingId) return res.status(404).json({ error: 'No gallery linked' });
      const gallery = await storage.getGalleryByBookingId(conv.bookingId);
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
      const booking = await storage.getBooking(conv.bookingId);
      res.json({
        galleryId: gallery.id,
        accessCode: gallery.accessCode,
        clientEmail: gallery.clientEmail,
        title: booking ? `${booking.clientName} – ${booking.serviceType}` : 'Gallery',
        coverUrl: (gallery.finalImages?.[0] || gallery.galleryImages?.[0]) ?? null,
        imageCount: (gallery.finalImages?.length || gallery.galleryImages?.length) ?? 0,
        accessLink: `/gallery?email=${encodeURIComponent(gallery.clientEmail)}&code=${gallery.accessCode}`,
      });
    } catch (error) {
      console.error('Error fetching conversation gallery:', error);
      res.status(500).json({ error: 'Failed to fetch gallery' });
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

  app.post('/api/admin/conversations', isAdmin, async (req, res) => {
    try {
      const adminId = (req as any).user?.id;
      const schema = z.object({
        userIds: z.array(z.string().min(1)).min(1),
        title: z.string().optional(),
      });
      const { userIds, title } = schema.parse(req.body);
      const otherIds = [...new Set(userIds.filter((id: string) => id !== adminId))];

      if (otherIds.length === 1) {
        const existing = await storage.findDirectConversation(adminId, otherIds[0]);
        if (existing) return res.json(existing);
        const conv = await storage.createConversation({
          type: 'direct',
          participantIds: [adminId, otherIds[0]],
        });
        return res.json(conv);
      }

      if (!title?.trim()) {
        return res.status(400).json({ error: 'Title required for group chats.' });
      }
      const conv = await storage.createConversation({
        type: 'group',
        title: title.trim(),
        participantIds: [adminId, ...otherIds],
      });
      res.json(conv);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
      console.error('Error creating admin conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  // ===== USER PROFILE CARD =====
  app.get('/api/users/:id/profile-card', isAuthenticated, async (req, res) => {
    try {
      const targetId = req.params.id;
      const callerId = (req as any).user?.id;
      const isCallerAdmin = (req as any).user?.isAdmin;
      const target = await storage.getUser(targetId);
      if (!target) return res.status(404).json({ error: 'User not found' });
      const base = {
        id: target.id, firstName: target.firstName, lastName: target.lastName,
        email: target.email, role: target.role, profileImageUrl: target.profileImageUrl,
        isAdmin: target.isAdmin, createdAt: target.createdAt,
      };
      if (isCallerAdmin || callerId === targetId) {
        const bookings = target.role === 'photographer'
          ? await storage.getPhotographerBookings(targetId)
          : await storage.getUserBookings(target.email ?? '');
        const galleries = await storage.getUserGalleries(target.email ?? '');
        const catalogues = target.role === 'photographer'
          ? await storage.getCataloguesByPhotographerId(targetId) : [];
        return res.json({ ...base, bookings, galleries, catalogues });
      }
      const caller = await storage.getUser(callerId);
      if (caller?.role === 'photographer') {
        const allBookings = await storage.getPhotographerBookings(callerId);
        const sharedBookings = allBookings.filter((b: any) => b.email === target.email);
        const galleries = (await Promise.all(sharedBookings.map((b: any) => storage.getGalleryByBookingId(b.id)))).filter(Boolean);
        return res.json({ ...base, bookings: sharedBookings, galleries, catalogues: [] });
      } else {
        const catalogues = (await storage.getCataloguesByPhotographerId(targetId)).filter((c: any) => c.isPublished);
        const allBookings = await storage.getUserBookings(caller?.email ?? '');
        const sharedBookings = allBookings.filter((b: any) => b.photographerId === targetId);
        return res.json({ ...base, bookings: sharedBookings, galleries: [], catalogues });
      }
    } catch (error) {
      console.error('Error fetching user profile card:', error);
      res.status(500).json({ error: 'Failed to fetch profile card' });
    }
  });

  // ===== CONVERSATION BOOKING CARD =====
  app.get('/api/conversations/:id/booking-card', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const isUserAdmin = (req as any).user?.isAdmin;
      const isParticipant = await storage.isParticipant(req.params.id, userId);
      if (!isParticipant && !isUserAdmin) return res.status(403).json({ error: 'Forbidden' });
      const conv = await storage.getConversation(req.params.id);
      if (!conv?.bookingId) return res.status(404).json({ error: 'No booking linked' });
      const booking = await storage.getBooking(conv.bookingId);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      const balanceDue = booking.totalPrice - Math.round(booking.totalPrice * 0.5);
      res.json({
        bookingId: booking.id, clientName: booking.clientName, serviceType: booking.serviceType,
        packageType: booking.packageType, shootDate: booking.shootDate, shootTime: booking.shootTime,
        location: booking.location, parish: booking.parish, status: booking.status,
        totalPrice: booking.totalPrice, depositPaid: booking.depositPaid,
        balancePaid: booking.balancePaid, balanceDue,
      });
    } catch (error) {
      console.error('Error fetching conversation booking card:', error);
      res.status(500).json({ error: 'Failed to fetch booking card' });
    }
  });

  // ===== PHOTOGRAPHER CATALOGUES =====
  app.get('/api/photographer/catalogues', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const cats = await storage.getCataloguesByPhotographerId(userId);
      res.json(cats);
    } catch (error) {
      console.error('Error fetching photographer catalogues:', error);
      res.status(500).json({ error: 'Failed to fetch catalogues' });
    }
  });

  // ===== BLOG =====

  // Public: list published blog posts (paginated)
  app.get('/api/blog', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1')));
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '9'))));
      const posts = await storage.getBlogPosts(page, limit);
      res.json(posts);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  });

  // Public: single published post by slug
  app.get('/api/blog/:slug', async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      res.json(post);
    } catch (error) {
      console.error('Error fetching blog post:', error);
      res.status(500).json({ error: 'Failed to fetch blog post' });
    }
  });

  // Admin: list all blog posts
  app.get('/api/admin/blog', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  });

  // Admin: create blog post
  app.post('/api/admin/blog', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const data = insertBlogPostSchema.parse(req.body);
      const authorId = (req as any).user?.id;
      // Auto-set publishedAt when publishing
      const publishedAt = data.status === 'published' ? new Date() : null;
      const post = await storage.createBlogPost({ ...data, authorId, publishedAt } as any);
      res.json(post);
    } catch (error: any) {
      if (error?.name === 'ZodError') return res.status(400).json({ error: error.errors });
      console.error('Error creating blog post:', error);
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  });

  // Admin: update blog post
  app.put('/api/admin/blog/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const existing = await storage.getBlogPostById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Post not found' });
      // Set publishedAt when first publishing
      const publishedAt = req.body.status === 'published' && existing.status !== 'published'
        ? new Date()
        : existing.publishedAt;
      const post = await storage.updateBlogPost(req.params.id, { ...req.body, publishedAt });
      res.json(post);
    } catch (error) {
      console.error('Error updating blog post:', error);
      res.status(500).json({ error: 'Failed to update blog post' });
    }
  });

  // Admin: delete blog post
  app.delete('/api/admin/blog/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ok = await storage.deleteBlogPost(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Post not found' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete blog post' });
    }
  });

  // ===== SOCIAL MEDIA =====

  // In-memory Instagram cache (60 min TTL)
  let igCache: { data: any; expiresAt: number } | null = null;

  // Proxy Instagram Graph API feed
  app.get('/api/social/instagram', async (req, res) => {
    try {
      // Return cache if fresh
      if (igCache && Date.now() < igCache.expiresAt) {
        return res.json(igCache.data);
      }
      const tokenRow = await storage.getSiteConfig('instagram_access_token');
      const userIdRow = await storage.getSiteConfig('instagram_user_id');
      const accessToken = (tokenRow?.config as any)?.value;
      const userId = (userIdRow?.config as any)?.value;
      if (!accessToken || !userId) {
        return res.json({ media: [], configured: false });
      }
      const igUrl = `https://graph.instagram.com/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=12&access_token=${accessToken}`;
      const igRes = await fetch(igUrl);
      if (!igRes.ok) {
        const errText = await igRes.text();
        console.error('Instagram API error:', errText);
        return res.status(502).json({ error: 'Instagram API error', media: [], configured: true });
      }
      const igData = await igRes.json() as any;
      const payload = { media: igData.data || [], configured: true };
      igCache = { data: payload, expiresAt: Date.now() + 60 * 60 * 1000 };

      // Auto-refresh token if within 7 days of creating this session
      // (tokens are 60-day; we refresh proactively when called)
      try {
        const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
        const refreshRes = await fetch(refreshUrl);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json() as any;
          if (refreshData.access_token && refreshData.access_token !== accessToken) {
            await storage.upsertSiteConfig('instagram_access_token', { value: refreshData.access_token });
          }
        }
      } catch (_) { /* silent */ }

      return res.json(payload);
    } catch (error) {
      console.error('Instagram fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch Instagram feed', media: [], configured: false });
    }
  });

  // Public: social config (non-secret values)
  app.get('/api/social/config', async (req, res) => {
    try {
      const [tw, fb, tt, igEmbed, igProfile] = await Promise.all([
        storage.getSiteConfig('twitter_username'),
        storage.getSiteConfig('facebook_page_url'),
        storage.getSiteConfig('tiktok_username'),
        storage.getSiteConfig('instagram_embed_url'),
        storage.getSiteConfig('instagram_profile_url'),
      ]);
      res.json({
        twitterUsername: (tw?.config as any)?.value || null,
        facebookPageUrl: (fb?.config as any)?.value || null,
        tiktokUsername: (tt?.config as any)?.value || null,
        instagramEmbedUrl: (igEmbed?.config as any)?.value || null,
        instagramProfileUrl: (igProfile?.config as any)?.value || null,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch social config' });
    }
  });

  // Admin: update social config keys
  app.put('/api/admin/social-config', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { instagramEmbedUrl, instagramProfileUrl, twitterUsername, facebookPageUrl, tiktokUsername } = req.body;
      const updates: Promise<any>[] = [];
      if (instagramEmbedUrl !== undefined) updates.push(storage.upsertSiteConfig('instagram_embed_url', { value: instagramEmbedUrl }));
      if (instagramProfileUrl !== undefined) updates.push(storage.upsertSiteConfig('instagram_profile_url', { value: instagramProfileUrl }));
      if (twitterUsername !== undefined) updates.push(storage.upsertSiteConfig('twitter_username', { value: twitterUsername }));
      if (facebookPageUrl !== undefined) updates.push(storage.upsertSiteConfig('facebook_page_url', { value: facebookPageUrl }));
      if (tiktokUsername !== undefined) updates.push(storage.upsertSiteConfig('tiktok_username', { value: tiktokUsername }));
      await Promise.all(updates);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update social config' });
    }
  });

  // ── SEO: sitemap.xml ────────────────────────────────────────────────────────
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const BASE = 'https://www.connectagrapher.com';
      const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'weekly' },
        { url: '/portfolio', priority: '0.9', changefreq: 'weekly' },
        { url: '/blog', priority: '0.9', changefreq: 'daily' },
        { url: '/about', priority: '0.7', changefreq: 'monthly' },
        { url: '/contact', priority: '0.7', changefreq: 'monthly' },
        { url: '/booking', priority: '0.8', changefreq: 'monthly' },
      ];
      const posts = await storage.getBlogPosts(1, 500);
      const postEntries = posts.map((p) => ({
        url: `/blog/${p.slug}`,
        priority: '0.8',
        changefreq: 'weekly',
        lastmod: (p.updatedAt || p.publishedAt || p.createdAt)?.toISOString().split('T')[0],
      }));
      const allEntries = [...staticPages, ...postEntries];
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...allEntries.map((e) => [
          '  <url>',
          `    <loc>${BASE}${e.url}</loc>`,
          e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : '',
          `    <changefreq>${e.changefreq}</changefreq>`,
          `    <priority>${e.priority}</priority>`,
          '  </url>',
        ].filter(Boolean).join('\n')),
        '</urlset>',
      ].join('\n');
      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      res.status(500).send('<?xml version="1.0"?><urlset/>');
    }
  });

  // ===== PAYOUTS =====

  // GET /api/photographer/payout-details
  app.get('/api/photographer/payout-details', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const details = await storage.getPayoutDetails(userId);
      res.json(details);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/photographer/payout-details
  app.put('/api/photographer/payout-details', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const schema = z.object({
        method: z.enum(['bank', 'card']),
        bankName: z.string().optional(),
        bankBranch: z.string().optional(),
        accountHolderName: z.string().optional(),
        accountNumber: z.string().optional(),
        routingNumber: z.string().optional(),
        cardHolderName: z.string().optional(),
        cardNumber: z.string().max(4).optional(),
        cardType: z.string().optional(),
        cardIssuingBank: z.string().optional(),
        notes: z.string().optional(),
      });
      const data = schema.parse(req.body);
      await storage.savePayoutDetails(userId, data);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/photographer/payouts
  app.get('/api/photographer/payouts', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const list = await storage.getPhotographerPayouts(userId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/photographer/payouts/request
  app.post('/api/photographer/payouts/request', isPhotographerApproved, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const schema = z.object({
        bookingIds: z.array(z.string()).min(1, 'Select at least one booking'),
        currency: z.string().length(3).default('USD'),
      });
      const { bookingIds, currency } = schema.parse(req.body);

      const payoutDetails = await storage.getPayoutDetails(userId);
      if (!(payoutDetails as any)?.method) {
        return res.status(400).json({ error: 'Please save your payout details before requesting a payout.' });
      }

      const payoutCfg = await storage.getSiteConfig('payout_config');
      const payoutPct: number = (payoutCfg?.config as any)?.percentage ?? 70;

      const existingPayouts = await storage.getPhotographerPayouts(userId);
      let totalAmount = 0;
      const validatedIds: string[] = [];
      const bookingSnapshots: Array<{
        id: string; clientName: string; serviceType: string; shootDate: string;
        totalPrice: number; depositPaid: boolean; balancePaid: boolean;
        grossPaid: number; platformFee: number; photographerCut: number;
      }> = [];

      for (const bid of bookingIds) {
        const booking = await storage.getBooking(bid);
        if (!booking || booking.photographerId !== userId) continue;
        if (booking.status !== 'completed') continue;
        if (!booking.depositPaid && !booking.balancePaid) continue;
        const alreadyCovered = existingPayouts.some(p =>
          ['pending', 'processing', 'completed'].includes(p.status) &&
          (p.bookingIds as string[]).includes(bid)
        );
        if (alreadyCovered) continue;
        const depositAmt = Math.round(booking.totalPrice * 0.5);
        const grossPaid = (booking.depositPaid ? depositAmt : 0) + (booking.balancePaid ? (booking.totalPrice - depositAmt) : 0);
        const photographerCut = Math.round(grossPaid * payoutPct / 100);
        const platformFee = grossPaid - photographerCut;
        totalAmount += photographerCut;
        validatedIds.push(bid);
        bookingSnapshots.push({
          id: bid,
          clientName: booking.clientName,
          serviceType: booking.serviceType,
          shootDate: booking.shootDate,
          totalPrice: booking.totalPrice,
          depositPaid: booking.depositPaid ?? false,
          balancePaid: booking.balancePaid ?? false,
          grossPaid,
          platformFee,
          photographerCut,
        });
      }

      if (validatedIds.length === 0) {
        return res.status(400).json({ error: 'No eligible completed bookings found. Bookings must be completed with payment received and not already paid out.' });
      }

      const payout = await storage.createPayoutRequest({
        photographerId: userId,
        bookingIds: validatedIds,
        amount: totalAmount,
        currency,
        payoutMethod: (payoutDetails as any).method,
        payoutDetails: {
          ...(payoutDetails as Record<string, unknown>),
          bookingsSnapshot: bookingSnapshots,
          payoutPct,
        },
      });

      res.json(payout);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/admin/payouts
  app.get('/api/admin/payouts', isAdmin, async (_req, res) => {
    try {
      const list = await storage.getAllPayouts();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/payouts/:id
  app.patch('/api/admin/payouts/:id', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        status: z.enum(['pending', 'processing', 'completed', 'rejected']),
        adminNotes: z.string().optional(),
        referenceNumber: z.string().optional(),
        receiptUrl: z.string().url().optional(),
      });
      const { status, adminNotes, referenceNumber, receiptUrl } = schema.parse(req.body);
      const updated = await storage.updatePayoutStatus(req.params.id, status, adminNotes, referenceNumber, receiptUrl);
      if (!updated) return res.status(404).json({ error: 'Payout not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/admin/payout-config
  app.get('/api/admin/payout-config', isAdmin, async (_req, res) => {
    try {
      const cfg = await storage.getSiteConfig('payout_config');
      res.json({ percentage: (cfg?.config as any)?.percentage ?? 70 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/admin/payout-config
  app.put('/api/admin/payout-config', isAdmin, async (req, res) => {
    try {
      const { percentage } = z.object({ percentage: z.number().min(1).max(100) }).parse(req.body);
      await storage.upsertSiteConfig('payout_config', { percentage });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Custom Private Packages ──────────────────────────────────────────────────
  // GET /api/admin/custom-packages – list all
  app.get('/api/admin/custom-packages', isAdmin, async (_req, res) => {
    try {
      const pkgs = await storage.getAllCustomPackages();
      res.json(pkgs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/custom-packages – create
  app.post('/api/admin/custom-packages', isAdmin, async (req, res) => {
    try {
      const lineItemSchema = z.object({ name: z.string(), price: z.number().int().min(0) });
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        serviceType: z.string().min(1),
        totalPrice: z.number().int().positive(),
        depositAmount: z.number().int().min(0).optional().default(0),
        currency: z.string().length(3).optional().default('USD'),
        lineItems: z.array(lineItemSchema).optional().default([]),
      });
      const data = schema.parse(req.body);
      const pkg = await storage.createCustomPackage({
        ...data,
        createdBy: (req.user as any)?.id ?? null,
        isActive: true,
      });
      res.json(pkg);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/custom-packages/:id – update (name, isActive, etc.)
  app.patch('/api/admin/custom-packages/:id', isAdmin, async (req, res) => {
    try {
      const lineItemSchema = z.object({ name: z.string(), price: z.number().int().min(0) });
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        serviceType: z.string().optional(),
        totalPrice: z.number().int().positive().optional(),
        depositAmount: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        lineItems: z.array(lineItemSchema).optional(),
        isActive: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const pkg = await storage.updateCustomPackage(req.params.id, data);
      if (!pkg) return res.status(404).json({ error: 'Not found' });
      res.json(pkg);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/admin/custom-packages/:id
  app.delete('/api/admin/custom-packages/:id', isAdmin, async (req, res) => {
    try {
      await storage.deleteCustomPackage(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/custom-packages/:id – public endpoint for booking page
  app.get('/api/custom-packages/:id', async (req, res) => {
    try {
      const pkg = await storage.getCustomPackageById(req.params.id);
      if (!pkg || !pkg.isActive) return res.status(404).json({ error: 'Package not found' });
      res.json(pkg);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Photographer custom packages ──────────────────────────────────────────────
  app.get('/api/photographer/custom-packages', isPhotographerApproved, async (req, res) => {
    try {
      const pkgs = await storage.getCustomPackagesByCreator((req.user as any).id);
      res.json(pkgs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/photographer/custom-packages', isPhotographerApproved, async (req, res) => {
    try {
      const lineItemSchema = z.object({ name: z.string(), price: z.number().int().min(0) });
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        serviceType: z.string().min(1),
        totalPrice: z.number().int().positive(),
        depositAmount: z.number().int().min(0).optional().default(0),
        currency: z.string().length(3).optional().default('USD'),
        lineItems: z.array(lineItemSchema).optional().default([]),
      });
      const data = schema.parse(req.body);
      const pkg = await storage.createCustomPackage({
        ...data,
        createdBy: (req.user as any).id,
        isActive: true,
      });
      res.json(pkg);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/photographer/custom-packages/:id', isPhotographerApproved, async (req, res) => {
    try {
      const pkg = await storage.getCustomPackageById(req.params.id);
      if (!pkg || pkg.createdBy !== (req.user as any).id) return res.status(404).json({ error: 'Not found' });
      const lineItemSchema = z.object({ name: z.string(), price: z.number().int().min(0) });
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        serviceType: z.string().optional(),
        totalPrice: z.number().int().positive().optional(),
        depositAmount: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        lineItems: z.array(lineItemSchema).optional(),
        isActive: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const updated = await storage.updateCustomPackage(req.params.id, data);
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/photographer/custom-packages/:id', isPhotographerApproved, async (req, res) => {
    try {
      const pkg = await storage.getCustomPackageById(req.params.id);
      if (!pkg || pkg.createdBy !== (req.user as any).id) return res.status(404).json({ error: 'Not found' });
      await storage.deleteCustomPackage(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Booking Terms ────────────────────────────────────────────────────────────
  // Public: get terms for a booking (photographer custom or platform default)
  app.get('/api/booking-terms', async (req, res) => {
    try {
      const { DEFAULT_BOOKING_TERMS } = await import('@shared/booking-terms');
      const photographerId = req.query.photographerId as string | undefined;
      if (photographerId) {
        const custom = await storage.getPhotographerCustomTerms(photographerId);
        if (custom) return res.json(JSON.parse(custom));
      }
      const defaultTerms = await storage.getDefaultBookingTerms();
      res.json(defaultTerms ?? DEFAULT_BOOKING_TERMS);
    } catch {
      const { DEFAULT_BOOKING_TERMS } = await import('@shared/booking-terms');
      res.json(DEFAULT_BOOKING_TERMS);
    }
  });

  // Admin: get/set platform default terms
  app.get('/api/admin/booking-terms', isAdmin, async (_req, res) => {
    try {
      const { DEFAULT_BOOKING_TERMS } = await import('@shared/booking-terms');
      const terms = await storage.getDefaultBookingTerms();
      res.json(terms ?? DEFAULT_BOOKING_TERMS);
    } catch {
      const { DEFAULT_BOOKING_TERMS } = await import('@shared/booking-terms');
      res.json(DEFAULT_BOOKING_TERMS);
    }
  });

  app.put('/api/admin/booking-terms', isAdmin, async (req, res) => {
    try {
      const { header, sections } = req.body;
      if (!header || !Array.isArray(sections)) return res.status(400).json({ error: 'Invalid terms format' });
      await storage.saveDefaultBookingTerms({ header, sections });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to save terms' });
    }
  });

  // Photographer: get/set own custom terms
  app.get('/api/photographer/booking-terms', isPhotographerApproved, async (req, res) => {
    try {
      const { DEFAULT_BOOKING_TERMS } = await import('@shared/booking-terms');
      const userId = (req as any).user?.id;
      const custom = await storage.getPhotographerCustomTerms(userId);
      if (custom) return res.json({ ...JSON.parse(custom), isCustom: true });
      const defaultTerms = await storage.getDefaultBookingTerms();
      res.json({ ...(defaultTerms ?? DEFAULT_BOOKING_TERMS), isCustom: false });
    } catch {
      const { DEFAULT_BOOKING_TERMS } = await import('@shared/booking-terms');
      res.json({ ...DEFAULT_BOOKING_TERMS, isCustom: false });
    }
  });

  app.put('/api/photographer/booking-terms', isPhotographerApproved, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { header, sections } = req.body;
      if (!header || !Array.isArray(sections)) return res.status(400).json({ error: 'Invalid terms format' });
      await storage.savePhotographerCustomTerms(userId, JSON.stringify({ header, sections }));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to save terms' });
    }
  });

  app.delete('/api/photographer/booking-terms', isPhotographerApproved, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      await storage.savePhotographerCustomTerms(userId, null);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to reset terms' });
    }
  });

  // ── Exchange Rates ───────────────────────────────────────────────────────────
  app.get('/api/exchange-rates', async (_req, res) => {
    try {
      const rates = await fetchExchangeRates();
      res.json({ base: 'USD', rates, source: _rateCache ? 'cache' : 'live' });
    } catch (e) {
      res.json({ base: 'USD', rates: { JMD: 157, GBP: 0.79, CAD: 1.36, EUR: 0.92 }, source: 'default' });
    }
  });

  app.get('/api/admin/exchange-rates', isAdmin, async (_req, res) => {
    try {
      const row = await storage.getSiteConfig('exchange_rates');
      res.json(row?.config ?? { JMD: 157, GBP: 0.79, CAD: 1.36, EUR: 0.92 });
    } catch {
      res.json({ JMD: 157, GBP: 0.79, CAD: 1.36, EUR: 0.92 });
    }
  });

  app.put('/api/admin/exchange-rates', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        JMD: z.number().positive(),
        GBP: z.number().positive(),
        CAD: z.number().positive(),
        EUR: z.number().positive(),
      });
      const rates = schema.parse(req.body);
      await storage.upsertSiteConfig('exchange_rates', rates);
      // Bust the in-memory cache so next fetch uses new fallback
      _rateCache = null;
      res.json({ success: true, rates });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid rates', details: e.errors });
      res.status(500).json({ error: 'Failed to save exchange rates' });
    }
  });

  // ── SEO: robots.txt ─────────────────────────────────────────────────────────
  // ── Push Notification Routes ──────────────────────────────────────────────
  app.get('/api/push/vapid-public-key', (_req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push not configured' });
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  });

  app.post('/api/push/subscribe', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const schema = z.object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      });
      const { endpoint, keys } = schema.parse(req.body);
      await storage.savePushSubscription(userId, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid subscription data' });
      console.error('Push subscribe error:', error);
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  });

  app.delete('/api/push/unsubscribe', isAuthenticated, async (req, res) => {
    try {
      const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
      await storage.deletePushSubscription(endpoint);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Native push token (iOS APNs / Android FCM) — saved by Capacitor app on registration
  app.post('/api/push/native-token', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { token, platform } = z.object({
        token: z.string().min(1),
        platform: z.enum(['ios', 'android']),
      }).parse(req.body);
      await storage.saveNativePushToken(userId, token, platform);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid token data' });
      console.error('Native token save error:', error);
      res.status(500).json({ error: 'Failed to save token' });
    }
  });

  app.get('/robots.txt', (_req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send([
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /dashboard',
      'Disallow: /photographer',
      'Disallow: /api/',
      '',
      'Sitemap: https://www.connectagrapher.com/sitemap.xml',
    ].join('\n'));
  });

  const httpServer = createServer(app);
  return httpServer;
}
