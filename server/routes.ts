
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

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "",
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

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
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Falling back to OpenCV.");
  }
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze the object in this image (could be a 2D shape or a 3D real-world object from a mobile camera). 
              1. Detect its primary geometric profile or 3D shape ('Circle/Sphere', 'Square/Cube', 'Triangle/Pyramid', or 'Other').
              2. Detect its primary color.
              3. Assign it to a container number: 1 for Circle/Sphere, 2 for Square/Cube/Box, 3 for Triangle/Pyramid/Rectangle, 4 for Other.
              4. Provide a professional reason for this classification based on its visual features.
              
              Respond ONLY with a JSON object like this: 
              {"shape": "Circle", "color": "Red", "container": "1", "reason": "The object is a red spherical part with a clear circular profile."}`,
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
      category: result.container || "4",
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

        // Map shape to container number
        let containerNumber = "4"; // Default for Other
        const shape = result.detected_shape;
        if (shape === "Circle") containerNumber = "1";
        else if (shape === "Square") containerNumber = "2";
        else if (shape === "Triangle") containerNumber = "3";

        resolve({
          shape: shape,
          color: result.color && result.color !== "Unknown" ? result.color : "Detected",
          category: containerNumber,
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
        category: classification.category, // This now stores the container number (1, 2, 3, 4)
        reason: classification.reason,
        confidence: "Processed by AI Vision"
      });

      res.status(201).json(stored);
    } catch (error) {
      console.error("Classification error:", error);
      res.status(500).json({ message: "Processing failed" });
    }
  });

  return httpServer;
}
