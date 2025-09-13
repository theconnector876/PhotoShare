import { 
  users, bookings, galleries, contactMessages,
  type User, type UpsertUser, type Booking, type InsertBooking, 
  type Gallery, type InsertGallery, type ContactMessage, type InsertContactMessage 
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  makeUserAdmin(userId: string): Promise<User | undefined>;
  getAdminCount(): Promise<number>;
  getGalleryById(id: string): Promise<Gallery | undefined>;
  
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

export class DatabaseStorage implements IStorage {
  constructor() {}

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async makeUserAdmin(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isAdmin: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values(insertBooking)
      .returning();
    return booking;
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async getAllBookings(): Promise<Booking[]> {
    return await db.select().from(bookings).orderBy(bookings.createdAt);
  }

  async updateBookingStatus(id: string, status: string): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ status })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async createGallery(insertGallery: InsertGallery): Promise<Gallery> {
    const [gallery] = await db
      .insert(galleries)
      .values(insertGallery)
      .returning();
    return gallery;
  }

  async getGalleryByAccess(email: string, accessCode: string): Promise<Gallery | undefined> {
    const [gallery] = await db
      .select()
      .from(galleries)
      .where(and(
        eq(galleries.clientEmail, email),
        eq(galleries.accessCode, accessCode)
      ));
    return gallery;
  }

  async getGalleryByBookingId(bookingId: string): Promise<Gallery | undefined> {
    const [gallery] = await db
      .select()
      .from(galleries)
      .where(eq(galleries.bookingId, bookingId));
    return gallery;
  }

  async updateGalleryImages(id: string, images: string[], type: 'gallery' | 'selected' | 'final'): Promise<Gallery | undefined> {
    let updateData: any = {};
    if (type === 'gallery') {
      updateData.galleryImages = images;
    } else if (type === 'selected') {
      updateData.selectedImages = images;
    } else if (type === 'final') {
      updateData.finalImages = images;
    }
    
    const [gallery] = await db
      .update(galleries)
      .set(updateData)
      .where(eq(galleries.id, id))
      .returning();
    return gallery;
  }

  async createContactMessage(insertMessage: InsertContactMessage): Promise<ContactMessage> {
    const [message] = await db
      .insert(contactMessages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getAllContactMessages(): Promise<ContactMessage[]> {
    return await db.select().from(contactMessages).orderBy(contactMessages.createdAt);
  }

  async getAllGalleries(): Promise<Gallery[]> {
    return await db.select().from(galleries).orderBy(galleries.createdAt);
  }

  async getAdminCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isAdmin, true));
    return result[0].count;
  }

  async getGalleryById(id: string): Promise<Gallery | undefined> {
    const [gallery] = await db.select().from(galleries).where(eq(galleries.id, id));
    return gallery;
  }
}

export const storage = new DatabaseStorage();
