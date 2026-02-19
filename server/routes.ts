import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupPasswordAuth, hashPassword } from "./auth";
import { getSession } from "./session";
import passport from "passport";
import { insertBookingSchema, insertGallerySchema, insertContactMessageSchema, insertCatalogueSchema, insertReviewSchema, insertUserSchema } from "@shared/schema";
import { defaultPricingConfig } from "@shared/pricing";
import { defaultSiteConfig } from "@shared/site-config";
import { z } from "zod";
import { lemonSqueezySetup, createCheckout } from '@lemonsqueezy/lemonsqueezy.js';
import { sendBookingConfirmation, sendPaymentConfirmation, sendPasswordReset, sendPhotographerApproved, sendPhotographerRejected, sendAdminEmail } from "./email";
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

// Booking with user account creation schema
const bookingWithAccountSchema = insertBookingSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
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
  publishedAt: catalogue.publishedAt
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
  // Setup session and passport authentication
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Setup password authentication (includes /api/register, /api/login, /api/logout, /api/user)
  setupPasswordAuth(app);

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
          isAdmin: false, // New users are not admin by default
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

      // Calculate deposit and balance amounts (50% split)
      const depositAmount = Math.round(bookingData.totalPrice * 0.5);
      const balanceDue = bookingData.totalPrice - depositAmount;
      
      // Create the booking with calculated amounts
      const bookingWithAmounts = {
        ...bookingData,
        depositAmount,
        balanceDue
      };
      
      const booking = await storage.createBooking(bookingWithAmounts);
      
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

      // Send booking confirmation email (non-blocking)
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
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid status value', details: error.errors });
      }
      console.error('Error updating booking status:', error);
      res.status(500).json({ error: 'Failed to update booking status' });
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

  // Update gallery settings (download toggle, status)
  app.patch('/api/admin/gallery/:id/settings', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        downloadEnabled: z.boolean().optional(),
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
          redirectUrl: `${process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000')}/payment-success?booking=${bookingId}`,
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
      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '')
        .update(body)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.log('Webhook signature verification failed');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const event = req.body;
      
      // Handle different webhook events
      switch (event.meta.event_name) {
        case 'order_created': {
          const order = event.data;
          const customData = order.attributes.first_order_item?.product_options?.custom || {};
          const { booking_id, payment_type } = customData;
          
          if (booking_id && payment_type) {
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
      res.status(500).json({ error: 'Internal server error' });
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
      const catalogueData = catalogueSchema.parse(req.body);
      const catalogue = await storage.createCatalogue(catalogueData);
      res.json(catalogue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid catalogue data', details: error.errors });
      }
      console.error('Error creating catalogue:', error);
      res.status(500).json({ error: 'Failed to create catalogue' });
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
      });

      const emailData = emailSchema.parse(req.body);

      await sendAdminEmail(emailData.email, emailData.clientName, emailData.subject, emailData.message);

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
        message: 'Refund processed successfully',
        booking: updatedBooking,
        refundId: `refund_${Date.now()}`
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
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid assignment data', details: error.errors });
      }
      console.error('Error assigning photographer:', error);
      res.status(500).json({ error: 'Failed to assign photographer' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
