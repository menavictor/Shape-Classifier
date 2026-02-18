
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import express from "express";

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function classifyWithAI(imagePath: string): Promise<{ shape: string; color: string; category: string; reason: string }> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a product sorting expert. Classify the primary object in the image into one of these shapes:
- Circle (includes Spheres, Torus, round objects) -> Container 1
- Square (includes Cubes) -> Container 2
- Triangle (includes Pyramids) -> Container 3
- Rectangle -> Container 3
- Other (Hexagons, Pentagons, complex shapes) -> Container 4

Return strictly JSON format:
{
  "shape": "Circle" | "Square" | "Triangle" | "Rectangle" | "Other",
  "color": "string",
  "category": "1" | "2" | "3" | "4",
  "reason": "short explanation of detection"
}`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Classify this object for sorting into a numbered container."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      }
    ],
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    shape: result.shape || "Other",
    color: result.color || "Unknown",
    category: result.category || "4",
    reason: result.reason || "Analyzed using advanced AI vision."
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use('/uploads', express.static('uploads'));

  app.get(api.classifications.list.path, async (req, res) => {
    const data = await storage.getClassifications();
    res.json(data);
  });

  app.post(api.classifications.create.path, upload.single("image"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    const originalExt = path.extname(req.file.originalname);
    const newFilename = `${req.file.filename}${originalExt}`;
    const newPath = path.join("uploads", newFilename);
    
    try {
        fs.renameSync(req.file.path, newPath);
    } catch (err) {
        return res.status(500).json({ message: "File processing error" });
    }

    try {
      const classification = await classifyWithAI(newPath);

      const stored = await storage.createClassification({
        imageUrl: `/uploads/${newFilename}`,
        detectedShape: classification.shape,
        detectedColor: classification.color,
        category: classification.category,
        reason: classification.reason,
        confidence: "AI Vision (GPT-4o)"
      });

      res.status(201).json(stored);
    } catch (error) {
      console.error("Classification error:", error);
      res.status(500).json({ message: "Processing failed. Please try a clearer image." });
    }
  });

  return httpServer;
}
