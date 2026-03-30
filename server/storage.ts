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
  blogPosts,
  payouts,
  bookingBroadcasts,
  broadcastResponses,
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
  type BlogPost,
  type InsertBlogPost,
  type Payout,
  type BookingBroadcast,
  type BroadcastResponse,
  customPackages,
  type CustomPackage,
  pushSubscriptions,
  type PushSubscription,
  nativePushTokens,
  type NativePushToken,
  galleryAccessLogs,
  galleryDownloadLogs,
  galleryLikes,
  type GalleryAccessLog,
  type GalleryDownloadLog,
  type GalleryLike,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, lt, gt, isNull, or, inArray } from "drizzle-orm";

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
  updateBookingTransactionId(bookingId: string, transactionId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined>;
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
  updateGallery(id: string, data: Partial<Gallery>): Promise<Gallery | undefined>;
  updateGalleryImages(id: string, images: string[], type: 'gallery' | 'selected' | 'final'): Promise<Gallery | undefined>;
  updateGallerySettings(id: string, settings: { galleryDownloadEnabled?: boolean; selectedDownloadEnabled?: boolean; finalDownloadEnabled?: boolean; status?: string; watermarkSettings?: Record<string, any>; requireAccessCode?: boolean; requireEmail?: boolean; shareEnabled?: boolean }): Promise<Gallery | undefined>;
  // Gallery logs
  logGalleryAccess(galleryId: string, email: string | null, ipAddress: string | null, userAgent: string | null): Promise<void>;
  logGalleryDownload(galleryId: string, email: string | null, imageUrl: string, downloadType: string): Promise<void>;
  toggleGalleryLike(galleryId: string, email: string, imageUrl: string): Promise<{ liked: boolean }>;
  getGalleryLikes(galleryId: string): Promise<GalleryLike[]>;
  getGalleryAccessLogs(galleryId: string): Promise<GalleryAccessLog[]>;
  getGalleryDownloadLogs(galleryId: string): Promise<GalleryDownloadLog[]>;
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
  getCataloguesByPhotographerId(photographerId: string): Promise<Catalogue[]>;
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
  approveReview(id: string, approve?: boolean): Promise<Review | undefined>;
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

  // Broadcast operations
  createBroadcast(data: { bookingId: string; adminId: string; offerAmount: number; currency: string; targetPhotographerIds: string[]; notes?: string }): Promise<BookingBroadcast>;
  getBroadcastByBookingId(bookingId: string): Promise<BookingBroadcast | undefined>;
  getBroadcast(id: string): Promise<BookingBroadcast | undefined>;
  updateBroadcastOffer(id: string, offerAmount: number): Promise<BookingBroadcast | undefined>;
  cancelBroadcast(id: string): Promise<BookingBroadcast | undefined>;
  acceptBroadcast(id: string, photographerId: string): Promise<BookingBroadcast | undefined>;
  createBroadcastResponses(broadcastId: string, photographerIds: string[]): Promise<void>;
  getBroadcastResponses(broadcastId: string): Promise<(BroadcastResponse & { photographer: User | null })[]>;
  respondToBroadcast(broadcastId: string, photographerId: string, response: 'accepted' | 'declined'): Promise<BroadcastResponse | undefined>;
  closeOtherBroadcastResponses(broadcastId: string, acceptedPhotographerId: string): Promise<void>;
  getOpenBroadcastsForPhotographer(photographerId: string): Promise<(BookingBroadcast & { booking: Booking; myResponse: string })[]>;

  // Conversation operations
  getOrCreateSupportConversation(userId: string): Promise<Conversation>;
  createConversation(data: { type: string; bookingId?: string; title?: string; participantIds: string[]; observerIds?: string[] }): Promise<Conversation>;
  getConversationsForUser(userId: string, isAdmin?: boolean): Promise<ConversationWithMeta[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByBookingId(bookingId: string): Promise<Conversation | undefined>;
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
  addParticipant(conversationId: string, userId: string, role?: string): Promise<void>;
  removeParticipant(conversationId: string, userId: string): Promise<void>;
  getUserRoleInConversation(conversationId: string, userId: string): Promise<'member' | 'observer' | null>;
  findDirectConversation(adminId: string, otherUserId: string): Promise<Conversation | undefined>;
  getMessages(conversationId: string): Promise<MessageWithSender[]>;
  createMessage(data: { conversationId: string; senderId: string | null; messageType: string; body: string; imageUrl?: string }): Promise<Message>;
  deleteMessage(messageId: string, requesterId: string, isAdmin: boolean): Promise<boolean>;
  markConversationRead(conversationId: string, userId: string): Promise<void>;
  getTotalUnreadCount(userId: string): Promise<number>;

  // Blog post operations
  getBlogPosts(page?: number, limit?: number): Promise<BlogPost[]>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getBlogPostById(id: string): Promise<BlogPost | undefined>;
  getAllBlogPosts(): Promise<BlogPost[]>;
  createBlogPost(data: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, data: Partial<BlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: string): Promise<boolean>;

  // Booking terms operations
  getDefaultBookingTerms(): Promise<Record<string, unknown> | null>;
  saveDefaultBookingTerms(terms: Record<string, unknown>): Promise<void>;
  getPhotographerCustomTerms(photographerId: string): Promise<string | null>;
  savePhotographerCustomTerms(photographerId: string, terms: string | null): Promise<void>;

  // Payout operations
  getPayoutDetails(photographerId: string): Promise<Record<string, unknown>>;
  savePayoutDetails(photographerId: string, details: Record<string, unknown>): Promise<void>;
  createPayoutRequest(data: { photographerId: string; bookingIds: string[]; amount: number; currency: string; payoutMethod: string; payoutDetails: Record<string, unknown> }): Promise<Payout>;
  getPhotographerPayouts(photographerId: string): Promise<Payout[]>;
  getAllPayouts(): Promise<(Payout & { photographerName: string | null; photographerEmail: string | null })[]>;
  updatePayoutStatus(id: string, status: string, adminNotes?: string, referenceNumber?: string, receiptUrl?: string): Promise<Payout | undefined>;
  getPendingPayoutCount(): Promise<number>;

  // Custom package operations
  getAllCustomPackages(): Promise<import('@shared/schema').CustomPackage[]>;
  getCustomPackagesByCreator(createdBy: string): Promise<import('@shared/schema').CustomPackage[]>;
  getCustomPackageById(id: string): Promise<import('@shared/schema').CustomPackage | undefined>;
  createCustomPackage(data: Omit<import('@shared/schema').CustomPackage, 'id' | 'createdAt'>): Promise<import('@shared/schema').CustomPackage>;
  updateCustomPackage(id: string, data: Partial<import('@shared/schema').CustomPackage>): Promise<import('@shared/schema').CustomPackage | undefined>;
  deleteCustomPackage(id: string): Promise<void>;

  // Push notification operations
  savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
  getPushSubscriptionsForUsers(userIds: string[]): Promise<PushSubscription[]>;
  getConversationParticipantIds(conversationId: string): Promise<string[]>;
  saveNativePushToken(userId: string, token: string, platform: string): Promise<void>;
  deleteNativePushToken(token: string): Promise<void>;
  getNativeTokensForUsers(userIds: string[]): Promise<NativePushToken[]>;
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

  async updateGallery(id: string, data: Partial<Gallery>): Promise<Gallery | undefined> {
    const [gallery] = await db
      .update(galleries)
      .set(data as any)
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

  async updateBookingTransactionId(bookingId: string, transactionId: string, type: 'deposit' | 'balance'): Promise<Booking | undefined> {
    const updateData = type === 'deposit'
      ? { depositTransactionId: transactionId }
      : { balanceTransactionId: transactionId };

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

  async getCataloguesByPhotographerId(photographerId: string): Promise<Catalogue[]> {
    return await db.select().from(catalogues)
      .where(eq(catalogues.photographerId, photographerId))
      .orderBy(catalogues.sortOrder, catalogues.createdAt);
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

  async approveReview(id: string, approve = true): Promise<Review | undefined> {
    const [review] = await db
      .update(reviews)
      .set({ isApproved: approve })
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

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await db
      .delete(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ));
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

  async deleteMessage(messageId: string, requesterId: string, isAdmin: boolean): Promise<boolean> {
    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
    if (!msg) return false;
    if (!isAdmin && msg.senderId !== requesterId) return false;
    await db.delete(messages).where(eq(messages.id, messageId));
    return true;
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

  // Blog post operations
  async getBlogPosts(page = 1, limit = 9): Promise<BlogPost[]> {
    const offset = (page - 1) * limit;
    return await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.status, "published"))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")));
    return post;
  }

  async getBlogPostById(id: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async createBlogPost(data: InsertBlogPost): Promise<BlogPost> {
    const [post] = await db
      .insert(blogPosts)
      .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return post;
  }

  async updateBlogPost(id: string, data: Partial<BlogPost>): Promise<BlogPost | undefined> {
    const [post] = await db
      .update(blogPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return post;
  }

  async deleteBlogPost(id: string): Promise<boolean> {
    const result = await db.delete(blogPosts).where(eq(blogPosts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Payout operations ────────────────────────────────────────────────────

  async getPayoutDetails(photographerId: string): Promise<Record<string, unknown>> {
    const [profile] = await db
      .select({ payoutDetails: photographerProfiles.payoutDetails })
      .from(photographerProfiles)
      .where(eq(photographerProfiles.userId, photographerId));
    return (profile?.payoutDetails as Record<string, unknown>) ?? {};
  }

  async savePayoutDetails(photographerId: string, details: Record<string, unknown>): Promise<void> {
    await db
      .update(photographerProfiles)
      .set({ payoutDetails: details, updatedAt: new Date() })
      .where(eq(photographerProfiles.userId, photographerId));
  }

  async createPayoutRequest(data: {
    photographerId: string;
    bookingIds: string[];
    amount: number;
    currency: string;
    payoutMethod: string;
    payoutDetails: Record<string, unknown>;
  }): Promise<Payout> {
    const [payout] = await db
      .insert(payouts)
      .values({
        photographerId: data.photographerId,
        bookingIds: data.bookingIds,
        amount: data.amount,
        currency: data.currency,
        status: 'pending',
        payoutMethod: data.payoutMethod,
        payoutDetails: data.payoutDetails,
        requestedAt: new Date(),
        createdAt: new Date(),
      })
      .returning();
    return payout;
  }

  async getPhotographerPayouts(photographerId: string): Promise<Payout[]> {
    return await db
      .select()
      .from(payouts)
      .where(eq(payouts.photographerId, photographerId))
      .orderBy(desc(payouts.createdAt));
  }

  async getAllPayouts(): Promise<(Payout & { photographerName: string | null; photographerEmail: string | null })[]> {
    const rows = await db
      .select({
        payout: payouts,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(payouts)
      .leftJoin(users, eq(payouts.photographerId, users.id))
      .orderBy(desc(payouts.createdAt));

    return rows.map(r => ({
      ...r.payout,
      photographerName: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
      photographerEmail: r.email,
    }));
  }

  async updatePayoutStatus(id: string, status: string, adminNotes?: string, referenceNumber?: string, receiptUrl?: string): Promise<Payout | undefined> {
    const updateData: Partial<Payout> = { status };
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (referenceNumber !== undefined) updateData.referenceNumber = referenceNumber;
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;
    if (status === 'completed' || status === 'processing') updateData.processedAt = new Date();

    const [updated] = await db
      .update(payouts)
      .set(updateData)
      .where(eq(payouts.id, id))
      .returning();
    return updated;
  }

  async getDefaultBookingTerms(): Promise<Record<string, unknown> | null> {
    const row = await this.getSiteConfig('booking_terms');
    return row?.config ?? null;
  }

  async saveDefaultBookingTerms(terms: Record<string, unknown>): Promise<void> {
    await this.upsertSiteConfig('booking_terms', terms);
  }

  async getPhotographerCustomTerms(photographerId: string): Promise<string | null> {
    const [profile] = await db
      .select({ customTerms: photographerProfiles.customTerms })
      .from(photographerProfiles)
      .where(eq(photographerProfiles.userId, photographerId));
    return profile?.customTerms ?? null;
  }

  async savePhotographerCustomTerms(photographerId: string, terms: string | null): Promise<void> {
    await db
      .update(photographerProfiles)
      .set({ customTerms: terms, updatedAt: new Date() })
      .where(eq(photographerProfiles.userId, photographerId));
  }

  async getPendingPayoutCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payouts)
      .where(eq(payouts.status, 'pending'));
    return result[0]?.count ?? 0;
  }

  async getAllCustomPackages(): Promise<CustomPackage[]> {
    return db.select().from(customPackages).orderBy(desc(customPackages.createdAt));
  }

  async getCustomPackagesByCreator(createdBy: string): Promise<CustomPackage[]> {
    return db.select().from(customPackages).where(eq(customPackages.createdBy, createdBy)).orderBy(desc(customPackages.createdAt));
  }

  async getCustomPackageById(id: string): Promise<CustomPackage | undefined> {
    const [pkg] = await db.select().from(customPackages).where(eq(customPackages.id, id));
    return pkg;
  }

  async createCustomPackage(data: Omit<CustomPackage, 'id' | 'createdAt'>): Promise<CustomPackage> {
    const [pkg] = await db.insert(customPackages).values(data as any).returning();
    return pkg;
  }

  async updateCustomPackage(id: string, data: Partial<CustomPackage>): Promise<CustomPackage | undefined> {
    const [pkg] = await db.update(customPackages).set(data as any).where(eq(customPackages.id, id)).returning();
    return pkg;
  }

  async deleteCustomPackage(id: string): Promise<void> {
    await db.delete(customPackages).where(eq(customPackages.id, id));
  }

  // ── Broadcast implementations ─────────────────────────────────────────────

  async createBroadcast(data: { bookingId: string; adminId: string; offerAmount: number; currency: string; targetPhotographerIds: string[]; notes?: string }): Promise<BookingBroadcast> {
    const [broadcast] = await db.insert(bookingBroadcasts).values({
      bookingId: data.bookingId,
      adminId: data.adminId,
      offerAmount: data.offerAmount,
      currency: data.currency,
      targetPhotographerIds: data.targetPhotographerIds,
      notes: data.notes ?? null,
      status: 'open',
    }).returning();
    return broadcast;
  }

  async getBroadcastByBookingId(bookingId: string): Promise<BookingBroadcast | undefined> {
    const [b] = await db.select().from(bookingBroadcasts)
      .where(and(eq(bookingBroadcasts.bookingId, bookingId), eq(bookingBroadcasts.status, 'open')))
      .orderBy(desc(bookingBroadcasts.createdAt))
      .limit(1);
    return b;
  }

  async getBroadcast(id: string): Promise<BookingBroadcast | undefined> {
    const [b] = await db.select().from(bookingBroadcasts).where(eq(bookingBroadcasts.id, id));
    return b;
  }

  async updateBroadcastOffer(id: string, offerAmount: number): Promise<BookingBroadcast | undefined> {
    const [b] = await db.update(bookingBroadcasts)
      .set({ offerAmount, updatedAt: new Date() })
      .where(eq(bookingBroadcasts.id, id))
      .returning();
    return b;
  }

  async cancelBroadcast(id: string): Promise<BookingBroadcast | undefined> {
    const [b] = await db.update(bookingBroadcasts)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookingBroadcasts.id, id))
      .returning();
    return b;
  }

  async acceptBroadcast(id: string, photographerId: string): Promise<BookingBroadcast | undefined> {
    const [b] = await db.update(bookingBroadcasts)
      .set({ status: 'accepted', acceptedById: photographerId, updatedAt: new Date() })
      .where(eq(bookingBroadcasts.id, id))
      .returning();
    return b;
  }

  async createBroadcastResponses(broadcastId: string, photographerIds: string[]): Promise<void> {
    if (!photographerIds.length) return;
    await db.insert(broadcastResponses).values(
      photographerIds.map(pid => ({ broadcastId, photographerId: pid, response: 'pending' }))
    );
  }

  async getBroadcastResponses(broadcastId: string): Promise<(BroadcastResponse & { photographer: User | null })[]> {
    const rows = await db.select().from(broadcastResponses)
      .where(eq(broadcastResponses.broadcastId, broadcastId))
      .orderBy(broadcastResponses.createdAt);
    const results = await Promise.all(rows.map(async (r) => {
      const [photographer] = await db.select().from(users).where(eq(users.id, r.photographerId));
      return { ...r, photographer: photographer ?? null };
    }));
    return results;
  }

  async respondToBroadcast(broadcastId: string, photographerId: string, response: 'accepted' | 'declined'): Promise<BroadcastResponse | undefined> {
    const [r] = await db.update(broadcastResponses)
      .set({ response, respondedAt: new Date() })
      .where(and(eq(broadcastResponses.broadcastId, broadcastId), eq(broadcastResponses.photographerId, photographerId)))
      .returning();
    return r;
  }

  async closeOtherBroadcastResponses(broadcastId: string, acceptedPhotographerId: string): Promise<void> {
    await db.update(broadcastResponses)
      .set({ response: 'closed' })
      .where(and(
        eq(broadcastResponses.broadcastId, broadcastId),
        eq(broadcastResponses.response, 'pending'),
        sql`${broadcastResponses.photographerId} != ${acceptedPhotographerId}`
      ));
  }

  async getOpenBroadcastsForPhotographer(photographerId: string): Promise<(BookingBroadcast & { booking: Booking; myResponse: string })[]> {
    // Get all pending responses for this photographer
    const myResponses = await db.select().from(broadcastResponses)
      .where(and(eq(broadcastResponses.photographerId, photographerId), eq(broadcastResponses.response, 'pending')));

    const results = await Promise.all(myResponses.map(async (resp) => {
      const [broadcast] = await db.select().from(bookingBroadcasts)
        .where(and(eq(bookingBroadcasts.id, resp.broadcastId), eq(bookingBroadcasts.status, 'open')));
      if (!broadcast) return null;
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, broadcast.bookingId));
      if (!booking) return null;
      return { ...broadcast, booking, myResponse: resp.response };
    }));

    return results.filter(Boolean) as (BookingBroadcast & { booking: Booking; myResponse: string })[];
  }

  async savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
    await db.insert(pushSubscriptions)
      .values({ userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.p256dh, auth: sub.auth } });
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getPushSubscriptionsForUsers(userIds: string[]): Promise<PushSubscription[]> {
    if (!userIds.length) return [];
    return db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  }

  async logGalleryAccess(galleryId: string, email: string | null, ipAddress: string | null, userAgent: string | null): Promise<void> {
    await db.insert(galleryAccessLogs).values({ galleryId, email, ipAddress, userAgent });
  }

  async logGalleryDownload(galleryId: string, email: string | null, imageUrl: string, downloadType: string): Promise<void> {
    await db.insert(galleryDownloadLogs).values({ galleryId, email, imageUrl, downloadType });
  }

  async toggleGalleryLike(galleryId: string, email: string, imageUrl: string): Promise<{ liked: boolean }> {
    const existing = await db.select().from(galleryLikes)
      .where(and(eq(galleryLikes.galleryId, galleryId), eq(galleryLikes.email, email), eq(galleryLikes.imageUrl, imageUrl)));
    if (existing.length > 0) {
      await db.delete(galleryLikes)
        .where(and(eq(galleryLikes.galleryId, galleryId), eq(galleryLikes.email, email), eq(galleryLikes.imageUrl, imageUrl)));
      return { liked: false };
    } else {
      await db.insert(galleryLikes).values({ galleryId, email, imageUrl });
      return { liked: true };
    }
  }

  async getGalleryLikes(galleryId: string): Promise<GalleryLike[]> {
    return db.select().from(galleryLikes).where(eq(galleryLikes.galleryId, galleryId));
  }

  async getGalleryAccessLogs(galleryId: string): Promise<GalleryAccessLog[]> {
    return db.select().from(galleryAccessLogs).where(eq(galleryAccessLogs.galleryId, galleryId))
      .orderBy(desc(galleryAccessLogs.accessedAt));
  }

  async getGalleryDownloadLogs(galleryId: string): Promise<GalleryDownloadLog[]> {
    return db.select().from(galleryDownloadLogs).where(eq(galleryDownloadLogs.galleryId, galleryId))
      .orderBy(desc(galleryDownloadLogs.downloadedAt));
  }

  async getConversationParticipantIds(conversationId: string): Promise<string[]> {
    const rows = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
    return rows.map(r => r.userId);
  }

  async saveNativePushToken(userId: string, token: string, platform: string): Promise<void> {
    await db.insert(nativePushTokens)
      .values({ userId, token, platform })
      .onConflictDoUpdate({ target: nativePushTokens.token, set: { userId, platform } });
  }

  async deleteNativePushToken(token: string): Promise<void> {
    await db.delete(nativePushTokens).where(eq(nativePushTokens.token, token));
  }

  async getNativeTokensForUsers(userIds: string[]): Promise<NativePushToken[]> {
    if (!userIds.length) return [];
    return db.select().from(nativePushTokens).where(inArray(nativePushTokens.userId, userIds));
  }
}

export const storage = new DatabaseStorage();
