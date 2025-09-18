import { 
  users, bookings, galleries, contactMessages, catalogues, reviews,
  type User, type UpsertUser, type Booking, type InsertBooking, 
  type Gallery, type InsertGallery, type ContactMessage, type InsertContactMessage,
  type Catalogue, type InsertCatalogue, type Review, type InsertReview
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  makeUserAdmin(userId: string): Promise<User | undefined>;
  getAdminCount(): Promise<number>;
  getGalleryById(id: string): Promise<Gallery | undefined>;
  getUserBookings(userEmail: string): Promise<Booking[]>;
  getUserGalleries(userEmail: string): Promise<Gallery[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateBookingStripeIntentId(bookingId: string, intentId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined>;
  updateBookingPaymentStatus(bookingId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined>;
  
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
  
  // Catalogue operations
  createCatalogue(catalogue: InsertCatalogue): Promise<Catalogue>;
  getCatalogue(id: string): Promise<Catalogue | undefined>;
  getAllCatalogues(): Promise<Catalogue[]>;
  getPublishedCatalogues(): Promise<Catalogue[]>;
  getCataloguesByServiceType(serviceType: string): Promise<Catalogue[]>;
  publishCatalogue(id: string): Promise<Catalogue | undefined>;
  unpublishCatalogue(id: string): Promise<Catalogue | undefined>;
  
  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReview(id: string): Promise<Review | undefined>;
  getApprovedReviews(): Promise<Review[]>;
  getApprovedReviewsByCatalogue(catalogueId: string): Promise<Review[]>;
  getGeneralReviews(): Promise<Review[]>;
  approveReview(id: string): Promise<Review | undefined>;
  getAllReviews(): Promise<Review[]>;
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

  async getUserBookings(userEmail: string): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.email, userEmail)).orderBy(bookings.createdAt);
  }

  async getUserGalleries(userEmail: string): Promise<Gallery[]> {
    // Get galleries for bookings made by this user
    const userBookings = await this.getUserBookings(userEmail);
    const bookingIds = userBookings.map(booking => booking.id);
    
    if (bookingIds.length === 0) {
      return [];
    }
    
    // Get galleries associated with these bookings
    const userGalleries = await db.select().from(galleries)
      .where(sql`${galleries.bookingId} IN (${sql.join(bookingIds.map(id => sql`${id}`), sql`, `)})`);
    
    return userGalleries;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateBookingStripeIntentId(bookingId: string, intentId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined> {
    const updateData = type === 'deposit' 
      ? { stripeDepositIntentId: intentId }
      : { stripeBalanceIntentId: intentId };
    
    const [updatedBooking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();
    
    return updatedBooking;
  }

  async updateBookingPaymentStatus(bookingId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined> {
    const updateData = type === 'deposit' 
      ? { depositPaid: true }
      : { balancePaid: true };
    
    const [updatedBooking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();
    
    return updatedBooking;
  }

  // Catalogue operations
  async createCatalogue(insertCatalogue: InsertCatalogue): Promise<Catalogue> {
    const [catalogue] = await db
      .insert(catalogues)
      .values(insertCatalogue)
      .returning();
    return catalogue;
  }

  async getCatalogue(id: string): Promise<Catalogue | undefined> {
    const [catalogue] = await db.select().from(catalogues).where(eq(catalogues.id, id));
    return catalogue;
  }

  async getAllCatalogues(): Promise<Catalogue[]> {
    return await db.select().from(catalogues).orderBy(catalogues.createdAt);
  }

  async getPublishedCatalogues(): Promise<Catalogue[]> {
    return await db.select().from(catalogues)
      .where(eq(catalogues.isPublished, true))
      .orderBy(catalogues.publishedAt);
  }

  async getCataloguesByServiceType(serviceType: string): Promise<Catalogue[]> {
    return await db.select().from(catalogues)
      .where(and(
        eq(catalogues.serviceType, serviceType),
        eq(catalogues.isPublished, true)
      ))
      .orderBy(catalogues.publishedAt);
  }

  async publishCatalogue(id: string): Promise<Catalogue | undefined> {
    const [catalogue] = await db
      .update(catalogues)
      .set({ 
        isPublished: true,
        publishedAt: new Date()
      })
      .where(eq(catalogues.id, id))
      .returning();
    return catalogue;
  }

  async unpublishCatalogue(id: string): Promise<Catalogue | undefined> {
    const [catalogue] = await db
      .update(catalogues)
      .set({ 
        isPublished: false,
        publishedAt: null
      })
      .where(eq(catalogues.id, id))
      .returning();
    return catalogue;
  }

  // Review operations
  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db
      .insert(reviews)
      .values(insertReview)
      .returning();
    return review;
  }

  async getReview(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async getApprovedReviews(): Promise<Review[]> {
    return await db.select().from(reviews)
      .where(eq(reviews.isApproved, true))
      .orderBy(reviews.createdAt);
  }

  async getApprovedReviewsByCatalogue(catalogueId: string): Promise<Review[]> {
    return await db.select().from(reviews)
      .where(and(
        eq(reviews.catalogueId, catalogueId),
        eq(reviews.isApproved, true)
      ))
      .orderBy(reviews.createdAt);
  }

  async getGeneralReviews(): Promise<Review[]> {
    return await db.select().from(reviews)
      .where(and(
        eq(reviews.reviewType, 'general'),
        eq(reviews.isApproved, true)
      ))
      .orderBy(reviews.createdAt);
  }

  async approveReview(id: string): Promise<Review | undefined> {
    const [review] = await db
      .update(reviews)
      .set({ isApproved: true })
      .where(eq(reviews.id, id))
      .returning();
    return review;
  }

  async getAllReviews(): Promise<Review[]> {
    return await db.select().from(reviews).orderBy(reviews.createdAt);
  }
}

export const storage = new DatabaseStorage();
