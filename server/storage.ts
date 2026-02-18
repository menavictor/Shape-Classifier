import { type Classification, type InsertClassification } from "@shared/schema";
import fs from "fs/promises";
import path from "path";

export interface IStorage {
  getClassifications(): Promise<Classification[]>;
  createClassification(classification: InsertClassification): Promise<Classification>;
}

export class FileStorage implements IStorage {
  private filePath: string;
  private classifications: Classification[] = [];
  private currentId: number = 1;

  constructor() {
    this.filePath = path.join(process.cwd(), "data.json");
    this.initialize();
  }

  private async initialize() {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      this.classifications = JSON.parse(data);
      if (this.classifications.length > 0) {
        this.currentId = Math.max(...this.classifications.map(c => c.id)) + 1;
      }
    } catch (error) {
      this.classifications = [];
      await this.save();
    }
  }

  private async save() {
    await fs.writeFile(this.filePath, JSON.stringify(this.classifications, null, 2));
  }

  async getClassifications(): Promise<Classification[]> {
    return [...this.classifications].sort((a, b) => 
      new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime()
    );
  }

  async createClassification(insertClassification: InsertClassification): Promise<Classification> {
    const classification: Classification = {
      id: this.currentId++,
      imageUrl: insertClassification.imageUrl,
      detectedShape: insertClassification.detectedShape,
      detectedColor: insertClassification.detectedColor,
      category: insertClassification.category,
      reason: insertClassification.reason,
      confidence: insertClassification.confidence ?? null,
      createdAt: new Date(),
    };
    this.classifications.push(classification);
    await this.save();
    return classification;
  }
}

export const storage = new FileStorage();
