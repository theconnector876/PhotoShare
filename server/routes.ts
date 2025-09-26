import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { insertBookingSchema, insertGallerySchema, insertContactMessageSchema, insertCatalogueSchema, insertReviewSchema } from "@shared/schema";
import { z } from "zod";
import { lemonSqueezySetup, createCheckout } from '@lemonsqueezy/lemonsqueezy.js';

if (!process.env.LEMONSQUEEZY_API_KEY) {
  throw new Error('Missing required Lemon Squeezy secret: LEMONSQUEEZY_API_KEY');
}

// Configure Lemon Squeezy
lemonSqueezySetup({
  apiKey: process.env.LEMONSQUEEZY_API_KEY,
  onError: (error) => console.error('Lemon Squeezy Error:', error),
});

if (!process.env.LEMONSQUEEZY_STORE_ID) {
  throw new Error('Missing required Lemon Squeezy store ID: LEMONSQUEEZY_STORE_ID');
}
if (!process.env.LEMONSQUEEZY_VARIANT_ID) {
  throw new Error('Missing required Lemon Squeezy variant ID: LEMONSQUEEZY_VARIANT_ID');
}
if (!process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
  throw new Error('Missing required Lemon Squeezy webhook secret: LEMONSQUEEZY_WEBHOOK_SECRET');
}

// Admin-specific validation schemas
const statusUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"])
});

// Catalogue validation schemas
const catalogueSchema = insertCatalogueSchema;

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

// Safe DTOs for public responses
const createSafeCatalogueDTO = (catalogue: any) => ({
  id: catalogue.id,
  title: catalogue.title,
  description: catalogue.description,
  serviceType: catalogue.serviceType,
  coverImage: catalogue.coverImage,
  images: catalogue.images,
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
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  // Booking routes
  app.post("/api/bookings", async (req, res) => {
    try {
      const bookingData = insertBookingSchema.parse(req.body);
      const booking = await storage.createBooking(bookingData);
      
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

      res.json({ booking, accessCode });
    } catch (error) {
      res.status(400).json({ error: "Invalid booking data" });
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

  // Removed public gallery update route - moved to admin-only for security

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
      const userEmail = (req as any).user?.claims?.email || (req as any).user?.email;
      if (!userEmail) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const userBookings = await storage.getUserBookings(userEmail);
      res.json(userBookings);
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      res.status(500).json({ error: 'Failed to fetch user bookings' });
    }
  });

  app.get('/api/user/galleries', isAuthenticated, async (req, res) => {
    try {
      const userEmail = (req as any).user?.claims?.email || (req as any).user?.email;
      if (!userEmail) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const userGalleries = await storage.getUserGalleries(userEmail);
      res.json(userGalleries);
    } catch (error) {
      console.error('Error fetching user galleries:', error);
      res.status(500).json({ error: 'Failed to fetch user galleries' });
    }
  });

  // Lemon Squeezy payment routes
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { bookingId, paymentType } = req.body;
      
      if (!bookingId || !paymentType || !['deposit', 'balance'].includes(paymentType)) {
        return res.status(400).json({ error: 'Missing or invalid payment data' });
      }

      // Fetch booking to get server-side amount and validate payment state
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // CRITICAL: Only allow payments for confirmed bookings
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ error: 'Booking must be confirmed before payment can be processed' });
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

      // Create Lemon Squeezy checkout with custom pricing
      const checkout = await createCheckout({
        data: {
          type: 'checkouts',
          attributes: {
            custom_price: Math.round(amount * 100), // Convert dollars to cents
            checkout_options: {
              button_color: '#10B981', // Jamaica green theme
              embed: true // Enable overlay
            },
            checkout_data: {
              custom: {
                booking_id: bookingId,
                payment_type: paymentType,
                client_name: booking.clientName,
                service_type: booking.serviceType
              }
            }
          },
          relationships: {
            store: {
              data: { type: 'stores', id: process.env.LEMONSQUEEZY_STORE_ID }
            },
            variant: {
              data: { type: 'variants', id: process.env.LEMONSQUEEZY_VARIANT_ID }
            }
          }
        }
      });

      if (checkout.error) {
        console.error('Lemon Squeezy checkout creation error:', checkout.error);
        return res.status(500).json({ error: 'Failed to create checkout' });
      }

      // Store checkout ID on booking
      if (paymentType === 'deposit') {
        await storage.updateBookingLemonSqueezyCheckoutId(bookingId, checkout.data.id, 'deposit');
      } else {
        await storage.updateBookingLemonSqueezyCheckoutId(bookingId, checkout.data.id, 'balance');
      }

      res.json({ checkoutUrl: checkout.data.attributes.url });
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      res.status(500).json({ error: "Error creating checkout: " + error.message });
    }
  });

  app.get("/api/bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const userEmail = (req as any).user?.claims?.email || (req as any).user?.email;
      const booking = await storage.getBooking(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if user owns this booking or is admin
      const user = await storage.getUserByEmail(userEmail);
      if (booking.email !== userEmail && !user?.isAdmin) {
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

      // SECURITY: Only show payment info for confirmed bookings
      if (booking.status !== 'confirmed') {
        return res.status(403).json({ error: "Payment information only available for confirmed bookings" });
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
      const userEmail = (req as any).user?.claims?.email || (req as any).user?.email;
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

  const httpServer = createServer(app);
  return httpServer;
}
