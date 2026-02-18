
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import express from "express";
import { OpenAI } from "openai";

// Replit AI integration for OpenAI
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

async function classifyWithAI(imagePath: string): Promise<{ shape: string; color: string; category: string; reason: string }> {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze the main object in this image. 
              1. Detect its primary geometric shape ('Circle', 'Square', 'Triangle', or 'Other').
              2. Detect its primary color.
              3. Assign it to a business category (e.g., 'Electronics', 'Mechanical Parts', 'Packaging', 'Household').
              4. Provide a professional reason for this classification.
              
              Respond ONLY with a JSON object like this: 
              {"shape": "Circle", "color": "Red", "category": "Mechanical Parts", "reason": "The object is a red industrial washer with a clear circular profile."}`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty AI response");
    
    const result = JSON.parse(content);
    return {
      shape: result.shape || "Other",
      color: result.color || "Unknown",
      category: result.category || "General",
      reason: result.reason || "Processed by AI vision system.",
    };
  } catch (error) {
    console.error("AI classification error:", error);
    throw error;
  }
}

async function classifyWithOpenCV(imagePath: string): Promise<{ shape: string; color: string; category: string; reason: string }> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python3", ["server/lib/image_processor.py", imagePath]);
    let dataString = "";
    let errorString = "";

    pythonProcess.stdout.on("data", (data) => { dataString += data.toString(); });
    pythonProcess.stderr.on("data", (data) => { errorString += data.toString(); });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`OpenCV process failed: ${errorString}`));
      }
      try {
        const result = JSON.parse(dataString);
        if (result.error) return reject(new Error(result.error));
        resolve({
          shape: result.detected_shape,
          color: "Detected via CV",
          category: "General",
          reason: result.confidence || "Processed using local computer vision."
        });
      } catch (e) {
        reject(e);
      }
    });
  });
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
      let classification;
      try {
        classification = await classifyWithAI(newPath);
      } catch (aiError) {
        console.warn("AI failed, falling back to OpenCV:", aiError);
        classification = await classifyWithOpenCV(newPath);
      }

      const stored = await storage.createClassification({
        imageUrl: `/uploads/${newFilename}`,
        detectedShape: classification.shape,
        detectedColor: classification.color,
        category: classification.category,
        reason: classification.reason,
        confidence: "Processed"
      });

      res.status(201).json(stored);
    } catch (error) {
      console.error("Classification error:", error);
      res.status(500).json({ message: "Processing failed" });
    }
  });

  return httpServer;
}
