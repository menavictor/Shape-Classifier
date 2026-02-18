
import { db } from "./db";
import { classifications, type Classification, type InsertClassification } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getClassifications(): Promise<Classification[]>;
  createClassification(classification: InsertClassification): Promise<Classification>;
}

export class DatabaseStorage implements IStorage {
  async getClassifications(): Promise<Classification[]> {
    return await db.select().from(classifications).orderBy(desc(classifications.createdAt));
  }

  async createClassification(insertClassification: InsertClassification): Promise<Classification> {
    const [classification] = await db
      .insert(classifications)
      .values(insertClassification)
      .returning();
    return classification;
  }
}

export const storage = new DatabaseStorage();
