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

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  stripeDepositIntentId: text("stripe_deposit_intent_id"),
  stripeBalanceIntentId: text("stripe_balance_intent_id"),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

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
