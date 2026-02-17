
import { pgTable, text, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const classifications = pgTable("classifications", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  detectedShape: varchar("detected_shape", { length: 50 }).notNull(), // Circle, Square, Triangle, Other
  containerColor: varchar("container_color", { length: 20 }).notNull(), // Green, Blue, Yellow, Red
  confidence: text("confidence"), // Optional debug info
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClassificationSchema = createInsertSchema(classifications).omit({ 
  id: true, 
  createdAt: true 
});

export type Classification = typeof classifications.$inferSelect;
export type InsertClassification = z.infer<typeof insertClassificationSchema>;
