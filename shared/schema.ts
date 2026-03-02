import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, index, jsonb, relations } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for email/password authentication  
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // Keep existing varchar structure
  email: varchar("email").unique(), 
  password: varchar("password"), // Allow nullable for existing Replit OAuth users
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: text("phone"),
  isAdmin: boolean("is_admin").default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  role: text("role").notNull().default("client"), // client, photographer
  photographerStatus: text("photographer_status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const photographerProfiles = pgTable("photographer_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  displayName: text("display_name"),
  bio: text("bio"),
  location: text("location"),
  specialties: text("specialties").array().default([]),
  portfolioLinks: text("portfolio_links").array().default([]),
  pricing: text("pricing"),
  pricingConfig: jsonb("pricing_config").default({}),
  availability: text("availability"),
  phone: text("phone"),
  socials: jsonb("socials").default({}),
  verificationDocs: text("verification_docs").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pricingConfigs = pgTable("pricing_configs", {
  key: text("key").primaryKey(),
  config: jsonb("config").notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const siteConfigs = pgTable("site_configs", {
  key: text("key").primaryKey(),
  config: jsonb("config").notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photographerId: varchar("photographer_id").references(() => users.id),
  clientName: text("client_name").notNull(),
  email: text("email").notNull(),
  contactNumber: text("contact_number").notNull(),
  serviceType: text("service_type").notNull(), // photoshoot, wedding, event
  packageType: text("package_type").notNull(), // bronze, silver, gold, platinum
  hasPhotoPackage: boolean("has_photo_package").notNull().default(true),
  hasVideoPackage: boolean("has_video_package").notNull().default(false),
  videoPackageType: text("video_package_type"), // bronze, silver, gold, platinum (null if no video)
  numberOfPeople: integer("number_of_people").notNull().default(1),
  shootDate: text("shoot_date").notNull(),
  shootTime: text("shoot_time").notNull(),
  location: text("location").notNull(),
  parish: text("parish").notNull(),
  transportationFee: integer("transportation_fee").notNull().default(35),
  addons: text("addons").array().default([]),
  totalPrice: integer("total_price").notNull(),
  depositAmount: integer("deposit_amount").notNull().default(0),
  balanceDue: integer("balance_due").notNull().default(0),
  depositPaid: boolean("deposit_paid").notNull().default(false),
  balancePaid: boolean("balance_paid").notNull().default(false),
  lemonSqueezyDepositCheckoutId: text("lemonsqueezy_deposit_checkout_id"),
  lemonSqueezyBalanceCheckoutId: text("lemonsqueezy_balance_checkout_id"),
  lemonSqueezyDepositOrderId: text("lemonsqueezy_deposit_order_id"),
  lemonSqueezyBalanceOrderId: text("lemonsqueezy_balance_order_id"),
  invoiceUrl: text("invoice_url"),
  referralSource: text("referral_source").array().default([]),
  clientInitials: text("client_initials").notNull(),
  contractAccepted: boolean("contract_accepted").notNull().default(false),
  couponCode: text("coupon_code"),
  discountAmount: integer("discount_amount").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, confirmed, completed
  createdAt: timestamp("created_at").defaultNow(),
});

export const galleries = pgTable("galleries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id),
  clientEmail: text("client_email").notNull(),
  accessCode: text("access_code").notNull(),
  galleryImages: text("gallery_images").array().default([]),
  selectedImages: text("selected_images").array().default([]),
  finalImages: text("final_images").array().default([]),
  status: text("status").notNull().default("pending"), // pending, selection, editing, completed
  galleryDownloadEnabled: boolean("gallery_download_enabled").notNull().default(false),
  selectedDownloadEnabled: boolean("selected_download_enabled").notNull().default(false),
  finalDownloadEnabled: boolean("final_download_enabled").notNull().default(true),
  clientComment: text("client_comment"),
  imageComments: jsonb("image_comments").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("unread"), // unread, read, responded
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull().default("percentage"), // percentage | fixed
  discountValue: integer("discount_value").notNull(), // 0-100 for percentage, dollar amount for fixed
  isActive: boolean("is_active").notNull().default(true),
  usageLimit: integer("usage_limit"), // null = unlimited
  usageCount: integer("usage_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const catalogues = pgTable("catalogues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id),
  title: text("title").notNull(),
  description: text("description"),
  serviceType: text("service_type").notNull(), // photoshoot, wedding, event
  coverImage: text("cover_image").notNull(), // main display image for portfolio
  images: text("images").array().default([]), // all images in the catalogue
  isPublished: boolean("is_published").notNull().default(false), // admin control
  sortOrder: integer("sort_order").notNull().default(0), // admin order for display
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  photographerId: varchar("photographer_id"),
  photographerName: text("photographer_name"),
});

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  catalogueId: varchar("catalogue_id").references(() => catalogues.id), // null for general reviews
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  reviewText: text("review_text").notNull(),
  reviewType: text("review_type").notNull().default("general"), // "catalogue" or "general"
  isApproved: boolean("is_approved").notNull().default(false), // admin approval for display
  createdAt: timestamp("created_at").defaultNow(),
});

export const inboundEmails = pgTable("inbound_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resendEmailId: text("resend_email_id"), // Resend's email_id for API/dashboard lookup
  from: text("from").notNull(),
  to: text("to").notNull(),
  subject: text("subject"),
  textBody: text("text_body"),
  htmlBody: text("html_body"),
  isRead: boolean("is_read").notNull().default(false),
  status: text("status").notNull().default("unread"), // unread, read, responded
  receivedAt: timestamp("received_at").defaultNow(),
  threadId: varchar("thread_id"),
  direction: text("direction").notNull().default("inbound"), // "inbound" | "outbound"
  inReplyToHeader: text("in_reply_to_header"),
  messageIdHeader: text("message_id_header"),
  senderName: text("sender_name"),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull().default("support"),
  bookingId: varchar("booking_id").references(() => bookings.id),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversationParticipants = pgTable("conversation_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (t) => [index("idx_cp_conv").on(t.conversationId), index("idx_cp_user").on(t.userId)]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").references(() => users.id),
  messageType: text("message_type").notNull().default("text"),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("idx_msg_conv").on(t.conversationId, t.createdAt)]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertGallerySchema = createInsertSchema(galleries).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertCatalogueSchema = createInsertSchema(catalogues).omit({
  id: true,
  createdAt: true,
  publishedAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertPhotographerProfileSchema = createInsertSchema(photographerProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPricingConfigSchema = createInsertSchema(pricingConfigs).omit({
  updatedAt: true,
});

export const insertSiteConfigSchema = createInsertSchema(siteConfigs).omit({
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type PhotographerProfile = typeof photographerProfiles.$inferSelect;
export type InsertPhotographerProfile = z.infer<typeof insertPhotographerProfileSchema>;
export type PricingConfigRow = typeof pricingConfigs.$inferSelect;
export type InsertPricingConfig = z.infer<typeof insertPricingConfigSchema>;
export type SiteConfigRow = typeof siteConfigs.$inferSelect;
export type InsertSiteConfig = z.infer<typeof insertSiteConfigSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Gallery = typeof galleries.$inferSelect;
export type InsertGallery = z.infer<typeof insertGallerySchema>;

export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;

export type Catalogue = typeof catalogues.$inferSelect;
export type InsertCatalogue = z.infer<typeof insertCatalogueSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export type InboundEmail = typeof inboundEmails.$inferSelect;

export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, usageCount: true });
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({ id: true, joinedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type MessageWithSender = Message & {
  sender?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null; role: string | null } | null;
};
export type ConversationWithMeta = Conversation & {
  lastMessage?: Message | null;
  unreadCount: number;
  participants: User[];
  currentUserRole?: 'member' | 'observer';
};

export type EmailThread = {
  threadId: string;
  subject: string | null;
  from: { name: string; email: string };
  status: string;
  lastActivity: string;
  messages: InboundEmail[];
};
