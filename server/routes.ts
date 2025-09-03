import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookingSchema, insertGallerySchema, insertContactMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.get("/api/bookings", async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.get("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  app.patch("/api/bookings/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const booking = await storage.updateBookingStatus(req.params.id, status);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error) {
      res.status(500).json({ error: "Failed to update booking status" });
    }
  });

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

  app.patch("/api/gallery/:id/images", async (req, res) => {
    try {
      const { images, type } = req.body;
      const gallery = await storage.updateGalleryImages(req.params.id, images, type);
      if (!gallery) {
        return res.status(404).json({ error: "Gallery not found" });
      }
      res.json(gallery);
    } catch (error) {
      res.status(500).json({ error: "Failed to update gallery images" });
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

  app.get("/api/contact", async (req, res) => {
    try {
      const messages = await storage.getAllContactMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contact messages" });
    }
  });

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

  const httpServer = createServer(app);
  return httpServer;
}
