import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  email: text("email").notNull(),
  contactNumber: text("contact_number").notNull(),
  serviceType: text("service_type").notNull(), // photoshoot, wedding, event
  packageType: text("package_type").notNull(), // bronze, silver, gold, platinum
  numberOfPeople: integer("number_of_people").notNull().default(1),
  shootDate: text("shoot_date").notNull(),
  shootTime: text("shoot_time").notNull(),
  location: text("location").notNull(),
  parish: text("parish").notNull(),
  transportationFee: integer("transportation_fee").notNull().default(35),
  addons: text("addons").array().default([]),
  totalPrice: integer("total_price").notNull(),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Gallery = typeof galleries.$inferSelect;
export type InsertGallery = z.infer<typeof insertGallerySchema>;

export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
