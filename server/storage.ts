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
  coupons,
  inboundEmails,
  conversations,
  conversationParticipants,
  messages,
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
  type SiteConfigRow,
  type Coupon,
  type InsertCoupon,
  type InboundEmail,
  type Conversation,
  type Message,
  type MessageWithSender,
  type ConversationWithMeta,
  type EmailThread,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, lt, gt, isNull, or } from "drizzle-orm";

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
  updateGallerySettings(id: string, settings: { galleryDownloadEnabled?: boolean; selectedDownloadEnabled?: boolean; finalDownloadEnabled?: boolean; status?: string }): Promise<Gallery | undefined>;
  updateGalleryComment(id: string, comment: string): Promise<Gallery | undefined>;
  updateImageComment(id: string, imageUrl: string, comment: string): Promise<Gallery | undefined>;
  deleteUser(id: string): Promise<boolean>;
  updateUser(id: string, data: { firstName?: string; lastName?: string; email?: string; password?: string }): Promise<User | undefined>;
  blockUser(id: string, blocked: boolean): Promise<User | undefined>;
  
  // Contact operations
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  getAllContactMessages(): Promise<ContactMessage[]>;
  updateContactStatus(id: string, status: string): Promise<ContactMessage | undefined>;
  deleteContact(id: string): Promise<boolean>;

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
  deleteCatalogue(id: string): Promise<boolean>;
  
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

  // Coupon operations
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  getAllCoupons(): Promise<Coupon[]>;
  createCoupon(data: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, data: Partial<Coupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<boolean>;
  incrementCouponUsage(id: string): Promise<void>;

  // Inbound email operations
  saveInboundEmail(data: { resendEmailId?: string; from: string; to: string; subject?: string; textBody?: string; htmlBody?: string; inReplyToHeader?: string; messageIdHeader?: string; senderName?: string }): Promise<InboundEmail>;
  saveOutboundEmail(data: { threadId: string; to: string; subject: string; body: string; senderName: string }): Promise<InboundEmail>;
  getAllInboundEmails(): Promise<InboundEmail[]>;
  getEmailThreads(): Promise<EmailThread[]>;
  markInboundEmailRead(id: string, isRead: boolean): Promise<InboundEmail | undefined>;
  updateInboundEmailStatus(id: string, status: string): Promise<InboundEmail | undefined>;
  deleteInboundEmail(id: string): Promise<boolean>;

  // User profile
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string; profileImageUrl?: string }): Promise<User | undefined>;

  // Conversation operations
  getOrCreateSupportConversation(userId: string): Promise<Conversation>;
  createConversation(data: { type: string; bookingId?: string; title?: string; participantIds: string[]; observerIds?: string[] }): Promise<Conversation>;
  getConversationsForUser(userId: string, isAdmin?: boolean): Promise<ConversationWithMeta[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByBookingId(bookingId: string): Promise<Conversation | undefined>;
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
  addParticipant(conversationId: string, userId: string, role?: string): Promise<void>;
  getUserRoleInConversation(conversationId: string, userId: string): Promise<'member' | 'observer' | null>;
  findDirectConversation(adminId: string, otherUserId: string): Promise<Conversation | undefined>;
  getMessages(conversationId: string): Promise<MessageWithSender[]>;
  createMessage(data: { conversationId: string; senderId: string | null; messageType: string; body: string; imageUrl?: string }): Promise<Message>;
  markConversationRead(conversationId: string, userId: string): Promise<void>;
  getTotalUnreadCount(userId: string): Promise<number>;
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

  async updateGallerySettings(id: string, settings: { galleryDownloadEnabled?: boolean; selectedDownloadEnabled?: boolean; finalDownloadEnabled?: boolean; status?: string }): Promise<Gallery | undefined> {
    const [gallery] = await db
      .update(galleries)
      .set(settings)
      .where(eq(galleries.id, id))
      .returning();
    return gallery;
  }

  async updateGalleryComment(id: string, comment: string): Promise<Gallery | undefined> {
    const [gallery] = await db
      .update(galleries)
      .set({ clientComment: comment })
      .where(eq(galleries.id, id))
      .returning();
    return gallery;
  }

  async updateImageComment(id: string, imageUrl: string, comment: string): Promise<Gallery | undefined> {
    const gallery = await this.getGalleryById(id);
    if (!gallery) return undefined;
    const current = (gallery.imageComments as Record<string, string>) || {};
    const updated = comment ? { ...current, [imageUrl]: comment } : Object.fromEntries(Object.entries(current).filter(([k]) => k !== imageUrl));
    const [result] = await db.update(galleries).set({ imageComments: updated }).where(eq(galleries.id, id)).returning();
    return result;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateUser(id: string, data: { firstName?: string; lastName?: string; email?: string; password?: string }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async blockUser(id: string, blocked: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isBlocked: blocked, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
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

  async updateContactStatus(id: string, status: string): Promise<ContactMessage | undefined> {
    const [msg] = await db.update(contactMessages).set({ status }).where(eq(contactMessages.id, id)).returning();
    return msg;
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await db.delete(contactMessages).where(eq(contactMessages.id, id));
    return (result.rowCount ?? 0) > 0;
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

  async deleteCatalogue(id: string): Promise<boolean> {
    const result = await db.delete(catalogues).where(eq(catalogues.id, id));
    return (result.rowCount ?? 0) > 0;
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

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon;
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(coupons.createdAt);
  }

  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    const [coupon] = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() }).returning();
    return coupon;
  }

  async updateCoupon(id: string, data: Partial<Coupon>): Promise<Coupon | undefined> {
    const [coupon] = await db.update(coupons).set(data).where(eq(coupons.id, id)).returning();
    return coupon;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    const result = await db.delete(coupons).where(eq(coupons.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async incrementCouponUsage(id: string): Promise<void> {
    await db.update(coupons).set({ usageCount: sql`${coupons.usageCount} + 1` }).where(eq(coupons.id, id));
  }

  async saveInboundEmail(data: { resendEmailId?: string; from: string; to: string; subject?: string; textBody?: string; htmlBody?: string; inReplyToHeader?: string; messageIdHeader?: string; senderName?: string }): Promise<InboundEmail> {
    // Determine threadId: if In-Reply-To header matches a known Message-ID, join that thread
    let threadId: string | null = null;
    if (data.inReplyToHeader) {
      const [parent] = await db
        .select()
        .from(inboundEmails)
        .where(eq(inboundEmails.messageIdHeader, data.inReplyToHeader))
        .limit(1);
      if (parent?.threadId) threadId = parent.threadId;
    }

    const [email] = await db
      .insert(inboundEmails)
      .values({ ...data, threadId })
      .returning();

    // If no thread found, use the email's own id as the thread root
    if (!email.threadId) {
      const [updated] = await db
        .update(inboundEmails)
        .set({ threadId: email.id })
        .where(eq(inboundEmails.id, email.id))
        .returning();
      return updated;
    }
    return email;
  }

  async saveOutboundEmail(data: { threadId: string; to: string; subject: string; body: string; senderName: string }): Promise<InboundEmail> {
    const [email] = await db
      .insert(inboundEmails)
      .values({
        from: `${data.senderName} <admin@connectagrapher.com>`,
        to: data.to,
        subject: data.subject,
        textBody: data.body,
        direction: 'outbound',
        threadId: data.threadId,
        senderName: data.senderName,
        isRead: true,
        status: 'responded',
      })
      .returning();
    return email;
  }

  async getAllInboundEmails(): Promise<InboundEmail[]> {
    return await db.select().from(inboundEmails).orderBy(inboundEmails.receivedAt);
  }

  async getEmailThreads(): Promise<EmailThread[]> {
    const allEmails = await db
      .select()
      .from(inboundEmails)
      .orderBy(inboundEmails.receivedAt);

    // Group by threadId
    const threadMap = new Map<string, InboundEmail[]>();
    for (const email of allEmails) {
      const tid = email.threadId ?? email.id;
      if (!threadMap.has(tid)) threadMap.set(tid, []);
      threadMap.get(tid)!.push(email);
    }

    // Build EmailThread array
    const threads: EmailThread[] = [];
    for (const [threadId, msgs] of threadMap.entries()) {
      // Root message is the first inbound one
      const root = msgs.find(m => m.direction === 'inbound') ?? msgs[0];
      const lastMsg = msgs[msgs.length - 1];

      // Parse from field
      const fromStr = root.from || '';
      const match = fromStr.match(/^(.*?)\s*<(.+)>$/);
      const fromParsed = match
        ? { name: match[1].trim() || match[2].trim(), email: match[2].trim() }
        : { name: fromStr, email: fromStr };

      // Thread status: unread if any inbound message is unread
      const hasUnread = msgs.some(m => m.direction === 'inbound' && m.status === 'unread');
      const allResponded = msgs.some(m => m.direction === 'outbound');
      const status = hasUnread ? 'unread' : allResponded ? 'responded' : 'read';

      threads.push({
        threadId,
        subject: root.subject ?? null,
        from: fromParsed,
        status,
        lastActivity: (lastMsg.receivedAt ?? new Date()).toISOString(),
        messages: msgs,
      });
    }

    // Sort by lastActivity descending
    threads.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
    return threads;
  }

  async markInboundEmailRead(id: string, isRead: boolean): Promise<InboundEmail | undefined> {
    const status = isRead ? 'read' : 'unread';
    const [email] = await db.update(inboundEmails).set({ isRead, status }).where(eq(inboundEmails.id, id)).returning();
    return email;
  }

  async updateInboundEmailStatus(id: string, status: string): Promise<InboundEmail | undefined> {
    const isRead = status !== 'unread';
    const [email] = await db.update(inboundEmails).set({ status, isRead }).where(eq(inboundEmails.id, id)).returning();
    return email;
  }

  async deleteInboundEmail(id: string): Promise<boolean> {
    const result = await db.delete(inboundEmails).where(eq(inboundEmails.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string; profileImageUrl?: string }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getOrCreateSupportConversation(userId: string): Promise<Conversation> {
    // Check if user already has a support conversation
    const rows = await db.execute(sql`
      SELECT c.* FROM conversations c
      INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.type = 'support' AND cp.user_id = ${userId}
      LIMIT 1
    `);
    const existing = rows.rows[0] as Conversation | undefined;
    if (existing) return existing;

    // Create new support conversation with all admins
    const allUsers = await this.getAllUsers();
    const adminIds = allUsers.filter(u => u.isAdmin).map(u => u.id);
    const participantIds = Array.from(new Set([userId, ...adminIds]));
    return this.createConversation({ type: 'support', title: 'Support', participantIds });
  }

  async createConversation(data: { type: string; bookingId?: string; title?: string; participantIds: string[]; observerIds?: string[] }): Promise<Conversation> {
    const [conv] = await db
      .insert(conversations)
      .values({ type: data.type, bookingId: data.bookingId, title: data.title })
      .returning();
    for (const uid of data.participantIds) {
      await db.insert(conversationParticipants).values({ conversationId: conv.id, userId: uid, role: 'member' }).onConflictDoNothing();
    }
    for (const uid of data.observerIds ?? []) {
      if (!data.participantIds.includes(uid)) {
        await db.insert(conversationParticipants).values({ conversationId: conv.id, userId: uid, role: 'observer' }).onConflictDoNothing();
      }
    }
    return conv;
  }

  async getConversationsForUser(userId: string, isAdmin?: boolean): Promise<ConversationWithMeta[]> {
    let convRows: Conversation[];
    if (isAdmin) {
      convRows = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
    } else {
      const rows = await db
        .select({ conv: conversations })
        .from(conversations)
        .innerJoin(conversationParticipants, eq(conversationParticipants.conversationId, conversations.id))
        .where(eq(conversationParticipants.userId, userId))
        .orderBy(desc(conversations.updatedAt));
      convRows = rows.map(r => r.conv);
    }

    const result: ConversationWithMeta[] = [];
    for (const conv of convRows) {
      const [lastMsg] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      // Get participant's lastReadAt for unread count
      const [myParticipant] = await db
        .select()
        .from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, conv.id), eq(conversationParticipants.userId, userId)));

      let unreadCount = 0;
      if (!isAdmin && myParticipant) {
        const since = myParticipant.lastReadAt;
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(and(
            eq(messages.conversationId, conv.id),
            since ? gt(messages.createdAt, since) : sql`true`,
            or(isNull(messages.senderId), sql`${messages.senderId} != ${userId}`)
          ));
        unreadCount = Number(countResult[0]?.count ?? 0);
      } else if (isAdmin) {
        const [myAdminPart] = await db
          .select()
          .from(conversationParticipants)
          .where(and(eq(conversationParticipants.conversationId, conv.id), eq(conversationParticipants.userId, userId)));
        if (myAdminPart) {
          const since = myAdminPart.lastReadAt;
          const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(and(
              eq(messages.conversationId, conv.id),
              since ? gt(messages.createdAt, since) : sql`true`,
              or(isNull(messages.senderId), sql`${messages.senderId} != ${userId}`)
            ));
          unreadCount = Number(countResult[0]?.count ?? 0);
        }
      }

      const participantRows = await db
        .select({ user: users })
        .from(users)
        .innerJoin(conversationParticipants, eq(conversationParticipants.userId, users.id))
        .where(eq(conversationParticipants.conversationId, conv.id));

      // Determine current user's role in this conversation
      const currentUserRole: 'member' | 'observer' = myParticipant
        ? ((myParticipant.role ?? 'member') as 'member' | 'observer')
        : 'observer';

      result.push({
        ...conv,
        lastMessage: lastMsg ?? null,
        unreadCount,
        participants: participantRows.map(r => r.user),
        currentUserRole,
      });
    }
    return result;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  }

  async getConversationByBookingId(bookingId: string): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.bookingId, bookingId));
    return conv;
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const [row] = await db
      .select()
      .from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));
    return !!row;
  }

  async addParticipant(conversationId: string, userId: string, role: string = 'member'): Promise<void> {
    await db
      .insert(conversationParticipants)
      .values({ conversationId, userId, role })
      .onConflictDoNothing();
  }

  async getUserRoleInConversation(conversationId: string, userId: string): Promise<'member' | 'observer' | null> {
    const [row] = await db
      .select({ role: conversationParticipants.role })
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ));
    if (!row) return null;
    return (row.role ?? 'member') as 'member' | 'observer';
  }

  async findDirectConversation(adminId: string, otherUserId: string): Promise<Conversation | undefined> {
    const rows = await db.execute(sql`
      SELECT c.* FROM conversations c
      WHERE c.type = 'direct'
        AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = ${adminId})
        AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = ${otherUserId})
        AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
      LIMIT 1
    `);
    return rows.rows[0] as Conversation | undefined;
  }

  async getMessages(conversationId: string): Promise<MessageWithSender[]> {
    const rows = await db
      .select({
        msg: messages,
        sender: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
        },
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderId))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return rows.map(r => ({
      ...r.msg,
      sender: r.sender?.id ? r.sender : null,
    }));
  }

  async createMessage(data: { conversationId: string; senderId: string | null; messageType: string; body: string; imageUrl?: string }): Promise<Message> {
    const [msg] = await db.insert(messages).values(data).returning();
    // Update conversation updatedAt
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, data.conversationId));
    return msg;
  }

  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ));
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    // Sum unread messages across all conversations the user participates in
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(cnt), 0) as total
      FROM (
        SELECT COUNT(*) as cnt
        FROM messages m
        INNER JOIN conversation_participants cp
          ON cp.conversation_id = m.conversation_id
          AND cp.user_id = ${userId}
        WHERE (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
          AND (m.sender_id IS NULL OR m.sender_id != ${userId})
      ) sub
    `);
    return Number((result.rows[0] as any)?.total ?? 0);
  }
}

export const storage = new DatabaseStorage();
