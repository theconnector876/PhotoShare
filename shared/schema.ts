import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
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
