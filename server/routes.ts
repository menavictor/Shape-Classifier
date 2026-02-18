
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

async function classifyWithOpenCV(imagePath: string): Promise<{ shape: string; color: string; category: string; reason: string }> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python3", ["server/lib/image_processor.py", imagePath]);
    let dataString = "";
    let errorString = "";

    pythonProcess.stdout.on("data", (data) => { dataString += data.toString(); });
    pythonProcess.stderr.on("data", (data) => { errorString += data.toString(); });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("OpenCV stderr:", errorString);
        return reject(new Error(`OpenCV process failed: ${errorString}`));
      }
      try {
        const result = JSON.parse(dataString.trim());
        if (result.error) return reject(new Error(result.error));

        resolve({
          shape: result.detected_shape || "Other",
          color: result.color || "Unknown",
          category: result.container || "4",
          reason: result.confidence || "Processed using local computer vision."
        });
      } catch (e) {
        console.error("Failed to parse OpenCV output:", dataString);
        reject(new Error("Failed to parse detection result"));
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
      const classification = await classifyWithOpenCV(newPath);

      const stored = await storage.createClassification({
        imageUrl: `/uploads/${newFilename}`,
        detectedShape: classification.shape,
        detectedColor: classification.color,
        category: classification.category,
        reason: classification.reason,
        confidence: "OpenCV Local Detection"
      });

      res.status(201).json(stored);
    } catch (error) {
      console.error("Classification error:", error);
      res.status(500).json({ message: "Processing failed. Please try a clearer image." });
    }
  });

  return httpServer;
}
