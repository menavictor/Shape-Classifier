import { z } from "zod";

export const classificationSchema = z.object({
  id: z.number(),
  imageUrl: z.string(),
  detectedShape: z.string(),
  detectedColor: z.string(),
  category: z.string(),
  reason: z.string(),
  confidence: z.string().nullable(),
  createdAt: z.date().or(z.string()),
});

export const insertClassificationSchema = classificationSchema.omit({ 
  id: true, 
  createdAt: true 
});

export type Classification = z.infer<typeof classificationSchema>;
export type InsertClassification = z.infer<typeof insertClassificationSchema>;

export * from "./models/chat";
