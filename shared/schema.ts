
import { pgTable, text, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const classifications = pgTable("classifications", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  detectedShape: varchar("detected_shape", { length: 50 }).notNull(),
  detectedColor: varchar("detected_color", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  reason: text("reason").notNull(),
  confidence: text("confidence"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClassificationSchema = createInsertSchema(classifications).omit({ 
  id: true, 
  createdAt: true 
});

export type Classification = typeof classifications.$inferSelect;
export type InsertClassification = z.infer<typeof insertClassificationSchema>;

export * from "./models/chat";
