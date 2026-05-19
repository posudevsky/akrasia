import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWaitlistSchema = createInsertSchema(waitlistTable).omit({ id: true, createdAt: true });
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type Waitlist = typeof waitlistTable.$inferSelect;

export const adaptationsTable = pgTable("adaptations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  vacancySnippet: text("vacancy_snippet").notNull(),
  vacancyText: text("vacancy_text").notNull(),
  resumeText: text("resume_text").notNull(),
  adaptedResume: text("adapted_resume").notNull(),
  matchScore: integer("match_score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdaptationSchema = createInsertSchema(adaptationsTable).omit({ id: true, createdAt: true });
export type InsertAdaptation = z.infer<typeof insertAdaptationSchema>;
export type Adaptation = typeof adaptationsTable.$inferSelect;
