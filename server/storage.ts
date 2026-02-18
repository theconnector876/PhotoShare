import { 
  users,
  bookings,
  galleries,
  contactMessages,
  catalogues,
  reviews,
  passwordResetTokens,
  photographerProfiles,
  pricingConfigs,
  siteConfigs,
  type User,
  type UpsertUser,
  type Booking,
  type InsertBooking,
  type Gallery,
  type InsertGallery,
  type ContactMessage,
  type InsertContactMessage,
  type Catalogue,
  type InsertCatalogue,
  type Review,
  type InsertReview,
  type PasswordResetToken,
  type PhotographerProfile,
  type InsertPhotographerProfile,
  type PricingConfigRow,
  type SiteConfigRow
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>; // Added for auth deserialization
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>; // Added for registration
  createPhotographerProfile(profile: InsertPhotographerProfile): Promise<PhotographerProfile>;
  getPhotographerProfileByUserId(userId: string): Promise<PhotographerProfile | undefined>;
  updatePhotographerProfile(userId: string, profile: Partial<PhotographerProfile>): Promise<PhotographerProfile | undefined>;
  getPendingPhotographers(): Promise<Array<{ user: User; profile?: PhotographerProfile }>>;
  getAllPhotographers(): Promise<User[]>;
  updatePhotographerStatus(userId: string, status: string): Promise<User | undefined>;
  updatePhotographerPricing(userId: string, pricingConfig: Record<string, unknown>): Promise<PhotographerProfile | undefined>;
  getPricingConfig(key: string): Promise<PricingConfigRow | undefined>;
  upsertPricingConfig(key: string, config: Record<string, unknown>): Promise<PricingConfigRow>;
  getSiteConfig(key: string): Promise<SiteConfigRow | undefined>;
  upsertSiteConfig(key: string, config: Record<string, unknown>): Promise<SiteConfigRow>;
  makeUserAdmin(userId: string): Promise<User | undefined>;
  getAdminCount(): Promise<number>;
  getGalleryById(id: string): Promise<Gallery | undefined>;
  getUserBookings(userEmail: string): Promise<Booking[]>;
  getUserGalleries(userEmail: string): Promise<Gallery[]>;
  getPhotographerBookings(userId: string): Promise<Booking[]>;
  getPhotographerGalleries(userId: string): Promise<Gallery[]>;
  updateBookingLemonSqueezyCheckoutId(bookingId: string, checkoutId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined>;
  updateBookingLemonSqueezyOrderId(bookingId: string, orderId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined>;
  updateBookingPaymentStatus(bookingId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined>;
  
  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBooking(id: string): Promise<Booking | undefined>;
  getAllBookings(): Promise<Booking[]>;
  updateBookingStatus(id: string, status: string): Promise<Booking | undefined>;
  updateBooking(id: string, booking: Partial<Booking>): Promise<Booking | undefined>;
  assignBookingPhotographer(id: string, photographerId: string | null): Promise<Booking | undefined>;
  
  // Gallery operations
  createGallery(gallery: InsertGallery): Promise<Gallery>;
  getGalleryByAccess(email: string, accessCode: string): Promise<Gallery | undefined>;
  getGalleryByBookingId(bookingId: string): Promise<Gallery | undefined>;
  updateGalleryImages(id: string, images: string[], type: 'gallery' | 'selected' | 'final'): Promise<Gallery | undefined>;
  updateGallerySettings(id: string, settings: { downloadEnabled?: boolean; status?: string }): Promise<Gallery | undefined>;
  
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
  updateCatalogue(id: string, data: Partial<Catalogue>): Promise<Catalogue | undefined>;
  updateCatalogueSortOrder(id: string, sortOrder: number): Promise<Catalogue | undefined>;
  
  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReview(id: string): Promise<Review | undefined>;
  getApprovedReviews(): Promise<Review[]>;
  getApprovedReviewsByCatalogue(catalogueId: string): Promise<Review[]>;
  getGeneralReviews(): Promise<Review[]>;
  approveReview(id: string): Promise<Review | undefined>;
  getAllReviews(): Promise<Review[]>;
  getReviewByCatalogueAndEmail(catalogueId: string, email: string): Promise<Review | undefined>;

  // Password reset operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | undefined>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  deletePasswordResetToken(token: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  constructor() {}

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(userData: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
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

  async createPhotographerProfile(profile: InsertPhotographerProfile): Promise<PhotographerProfile> {
    const [created] = await db
      .insert(photographerProfiles)
      .values({
        ...profile,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async getPhotographerProfileByUserId(userId: string): Promise<PhotographerProfile | undefined> {
    const [profile] = await db
      .select()
      .from(photographerProfiles)
      .where(eq(photographerProfiles.userId, userId));
    return profile;
  }

  async updatePhotographerProfile(userId: string, profile: Partial<PhotographerProfile>): Promise<PhotographerProfile | undefined> {
    const [updated] = await db
      .update(photographerProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(photographerProfiles.userId, userId))
      .returning();
    return updated;
  }

  async getPendingPhotographers(): Promise<Array<{ user: User; profile?: PhotographerProfile }>> {
    const rows = await db
      .select({ user: users, profile: photographerProfiles })
      .from(users)
      .leftJoin(photographerProfiles, eq(photographerProfiles.userId, users.id))
      .where(and(eq(users.role, "photographer"), eq(users.photographerStatus, "pending")));
    return rows.map((row) => ({ user: row.user, profile: row.profile ?? undefined }));
  }

  async getAllPhotographers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, "photographer"));
  }

  async updatePhotographerStatus(userId: string, status: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ photographerStatus: status, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updatePhotographerPricing(userId: string, pricingConfig: Record<string, unknown>): Promise<PhotographerProfile | undefined> {
    const [updated] = await db
      .update(photographerProfiles)
      .set({ pricingConfig, updatedAt: new Date() })
      .where(eq(photographerProfiles.userId, userId))
      .returning();
    return updated;
  }

  async getPricingConfig(key: string): Promise<PricingConfigRow | undefined> {
    const [row] = await db
      .select()
      .from(pricingConfigs)
      .where(eq(pricingConfigs.key, key));
    return row;
  }

  async upsertPricingConfig(key: string, config: Record<string, unknown>): Promise<PricingConfigRow> {
    const [row] = await db
      .insert(pricingConfigs)
      .values({ key, config, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pricingConfigs.key,
        set: { config, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async getSiteConfig(key: string): Promise<SiteConfigRow | undefined> {
    const [row] = await db
      .select()
      .from(siteConfigs)
      .where(eq(siteConfigs.key, key));
    return row;
  }

  async upsertSiteConfig(key: string, config: Record<string, unknown>): Promise<SiteConfigRow> {
    const [row] = await db
      .insert(siteConfigs)
      .values({ key, config, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteConfigs.key,
        set: { config, updatedAt: new Date() },
      })
      .returning();
    return row;
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

  async updateBooking(id: string, bookingData: Partial<Booking>): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set(bookingData)
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async assignBookingPhotographer(id: string, photographerId: string | null): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ photographerId })
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

  async getPhotographerBookings(userId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.photographerId, userId))
      .orderBy(bookings.createdAt);
  }

  async getPhotographerGalleries(userId: string): Promise<Gallery[]> {
    const rows = await db
      .select({ gallery: galleries, booking: bookings })
      .from(galleries)
      .leftJoin(bookings, eq(bookings.id, galleries.bookingId))
      .where(eq(bookings.photographerId, userId));
    return rows.map((row) => row.gallery);
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

  async updateGallerySettings(id: string, settings: { downloadEnabled?: boolean; status?: string }): Promise<Gallery | undefined> {
    const [gallery] = await db
      .update(galleries)
      .set(settings)
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateBookingLemonSqueezyCheckoutId(bookingId: string, checkoutId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined> {
    const updateData = type === 'deposit' 
      ? { lemonSqueezyDepositCheckoutId: checkoutId }
      : { lemonSqueezyBalanceCheckoutId: checkoutId };
    
    const [updatedBooking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();
    
    return updatedBooking;
  }

  async updateBookingLemonSqueezyOrderId(bookingId: string, orderId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined> {
    const updateData = type === 'deposit' 
      ? { lemonSqueezyDepositOrderId: orderId }
      : { lemonSqueezyBalanceOrderId: orderId };
    
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
    const [maxRow] = await db
      .select({ max: sql<number>`max(${catalogues.sortOrder})` })
      .from(catalogues);
    const nextSortOrder = (maxRow?.max ?? 0) + 1;
    const [catalogue] = await db
      .insert(catalogues)
      .values({
        ...insertCatalogue,
        sortOrder: insertCatalogue.sortOrder ?? nextSortOrder,
      })
      .returning();
    return catalogue;
  }

  async getCatalogue(id: string): Promise<Catalogue | undefined> {
    const [catalogue] = await db.select().from(catalogues).where(eq(catalogues.id, id));
    return catalogue;
  }

  async getAllCatalogues(): Promise<Catalogue[]> {
    return await db
      .select()
      .from(catalogues)
      .orderBy(catalogues.sortOrder, catalogues.createdAt);
  }

  async getPublishedCatalogues(): Promise<Catalogue[]> {
    return await db.select().from(catalogues)
      .where(eq(catalogues.isPublished, true))
      .orderBy(catalogues.sortOrder, catalogues.publishedAt);
  }

  async getCataloguesByServiceType(serviceType: string): Promise<Catalogue[]> {
    return await db.select().from(catalogues)
      .where(and(
        eq(catalogues.serviceType, serviceType),
        eq(catalogues.isPublished, true)
      ))
      .orderBy(catalogues.sortOrder, catalogues.publishedAt);
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

  async updateCatalogue(id: string, data: Partial<Catalogue>): Promise<Catalogue | undefined> {
    const [catalogue] = await db
      .update(catalogues)
      .set(data)
      .where(eq(catalogues.id, id))
      .returning();
    return catalogue;
  }

  async updateCatalogueSortOrder(id: string, sortOrder: number): Promise<Catalogue | undefined> {
    const [catalogue] = await db
      .update(catalogues)
      .set({ sortOrder })
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

  async getReviewByCatalogueAndEmail(catalogueId: string, email: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews)
      .where(and(
        eq(reviews.catalogueId, catalogueId),
        eq(reviews.clientEmail, email.toLowerCase().trim())
      ));
    return review;
  }

  // Password reset operations
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    });
  }

  async getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    
    if (resetToken) {
      return {
        userId: resetToken.userId,
        expiresAt: resetToken.expiresAt,
      };
    }
    return undefined;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await db.delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
  }
}

export const storage = new DatabaseStorage();
