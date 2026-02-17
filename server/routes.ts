
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
// Use gpt-4o for best vision capabilities
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

async function classifyWithAI(imagePath: string): Promise<{ shape: string; color: string; confidence: string }> {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Upgraded to gpt-4o for better vision
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze the main object in this image and classify its primary geometric shape as one of these: 'Circle', 'Square', 'Triangle', or 'Other'. Respond ONLY with a JSON object like this: {\"shape\": \"Circle\", \"color\": \"Green\", \"reason\": \"brief explanation\"}. Mapping: Circle->Green, Square->Blue, Triangle->Yellow, Other->Red.",
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
      color: result.color || "Red",
      confidence: `AI analysis: ${result.reason || "Processed by GPT-4o"}`,
    };
  } catch (error) {
    console.error("AI classification error:", error);
    throw error;
  }
}

async function classifyWithOpenCV(imagePath: string): Promise<{ shape: string; color: string; confidence: string }> {
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
          color: result.container_color,
          confidence: result.confidence
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
      // Primary: AI Analysis (requested for better accuracy)
      // Fallback: OpenCV logic
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
        containerColor: classification.color,
        confidence: classification.confidence
      });

      res.status(201).json(stored);
    } catch (error) {
      console.error("Classification error:", error);
      res.status(500).json({ message: "Processing failed" });
    }
  });

  return httpServer;
}
