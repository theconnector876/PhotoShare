import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { insertBookingSchema, insertGallerySchema, insertContactMessageSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Admin-specific validation schemas
const statusUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"])
});

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

  // Stripe payment routes
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

      let amount: number;
      if (paymentType === 'deposit') {
        if (booking.depositPaid) {
          return res.status(400).json({ error: 'Deposit already paid' });
        }
        amount = booking.depositAmount;
      } else {
        if (!booking.depositPaid) {
          return res.status(400).json({ error: 'Deposit must be paid first' });
        }
        if (booking.balancePaid) {
          return res.status(400).json({ error: 'Balance already paid' });
        }
        amount = booking.balanceDue;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // Amount already in cents
        currency: "usd",
        metadata: {
          bookingId,
          paymentType,
        },
      });

      // Store PaymentIntent ID on booking
      if (paymentType === 'deposit') {
        await storage.updateBookingStripeIntentId(bookingId, paymentIntent.id, 'deposit');
      } else {
        await storage.updateBookingStripeIntentId(bookingId, paymentIntent.id, 'balance');
      }

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ error: "Error creating payment intent: " + error.message });
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

  // Stripe webhook to handle payment success
  app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET || '');
    } catch (err: any) {
      console.log(`Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const { bookingId, paymentType } = paymentIntent.metadata;
        
        if (bookingId && paymentType) {
          await storage.updateBookingPaymentStatus(bookingId, paymentType as 'deposit' | 'balance');
          console.log(`Payment ${paymentType} successful for booking ${bookingId}`);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log(`Payment failed for booking ${paymentIntent.metadata.bookingId}`);
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
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

  const httpServer = createServer(app);
  return httpServer;
}
