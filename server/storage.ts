import { type User, type InsertUser, type Booking, type InsertBooking, type Gallery, type InsertGallery, type ContactMessage, type InsertContactMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBooking(id: string): Promise<Booking | undefined>;
  getAllBookings(): Promise<Booking[]>;
  updateBookingStatus(id: string, status: string): Promise<Booking | undefined>;
  
  // Gallery operations
  createGallery(gallery: InsertGallery): Promise<Gallery>;
  getGalleryByAccess(email: string, accessCode: string): Promise<Gallery | undefined>;
  getGalleryByBookingId(bookingId: string): Promise<Gallery | undefined>;
  updateGalleryImages(id: string, images: string[], type: 'gallery' | 'selected' | 'final'): Promise<Gallery | undefined>;
  
  // Contact operations
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  getAllContactMessages(): Promise<ContactMessage[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private bookings: Map<string, Booking>;
  private galleries: Map<string, Gallery>;
  private contactMessages: Map<string, ContactMessage>;

  constructor() {
    this.users = new Map();
    this.bookings = new Map();
    this.galleries = new Map();
    this.contactMessages = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = randomUUID();
    const booking: Booking = {
      ...insertBooking,
      id,
      status: "pending",
      createdAt: new Date(),
      numberOfPeople: insertBooking.numberOfPeople || 1,
      transportationFee: insertBooking.transportationFee || 35,
      addons: insertBooking.addons || [],
      referralSource: insertBooking.referralSource || [],
      contractAccepted: insertBooking.contractAccepted || false,
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getAllBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async updateBookingStatus(id: string, status: string): Promise<Booking | undefined> {
    const booking = this.bookings.get(id);
    if (booking) {
      booking.status = status;
      this.bookings.set(id, booking);
      return booking;
    }
    return undefined;
  }

  async createGallery(insertGallery: InsertGallery): Promise<Gallery> {
    const id = randomUUID();
    const gallery: Gallery = {
      ...insertGallery,
      id,
      status: "pending",
      createdAt: new Date(),
      bookingId: insertGallery.bookingId || null,
      galleryImages: insertGallery.galleryImages || [],
      selectedImages: insertGallery.selectedImages || [],
      finalImages: insertGallery.finalImages || [],
    };
    this.galleries.set(id, gallery);
    return gallery;
  }

  async getGalleryByAccess(email: string, accessCode: string): Promise<Gallery | undefined> {
    return Array.from(this.galleries.values()).find(
      (gallery) => gallery.clientEmail === email && gallery.accessCode === accessCode
    );
  }

  async getGalleryByBookingId(bookingId: string): Promise<Gallery | undefined> {
    return Array.from(this.galleries.values()).find(
      (gallery) => gallery.bookingId === bookingId
    );
  }

  async updateGalleryImages(id: string, images: string[], type: 'gallery' | 'selected' | 'final'): Promise<Gallery | undefined> {
    const gallery = this.galleries.get(id);
    if (gallery) {
      if (type === 'gallery') {
        gallery.galleryImages = images;
      } else if (type === 'selected') {
        gallery.selectedImages = images;
      } else if (type === 'final') {
        gallery.finalImages = images;
      }
      this.galleries.set(id, gallery);
      return gallery;
    }
    return undefined;
  }

  async createContactMessage(insertMessage: InsertContactMessage): Promise<ContactMessage> {
    const id = randomUUID();
    const message: ContactMessage = {
      ...insertMessage,
      id,
      status: "unread",
      createdAt: new Date(),
    };
    this.contactMessages.set(id, message);
    return message;
  }

  async getAllContactMessages(): Promise<ContactMessage[]> {
    return Array.from(this.contactMessages.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }
}

export const storage = new MemStorage();
