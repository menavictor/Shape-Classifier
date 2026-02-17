
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import express from "express";

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Serve uploaded files statically
  app.use('/uploads', express.static('uploads'));

  // Get all classifications
  app.get(api.classifications.list.path, async (req, res) => {
    const data = await storage.getClassifications();
    res.json(data);
  });

  // Create classification (Upload + Process)
  app.post(api.classifications.create.path, upload.single("image"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // Rename file to include extension for static serving
    const originalExt = path.extname(req.file.originalname);
    const newFilename = `${req.file.filename}${originalExt}`;
    const newPath = path.join("uploads", newFilename);
    
    try {
        fs.renameSync(req.file.path, newPath);
    } catch (err) {
        console.error("Failed to rename file:", err);
        return res.status(500).json({ message: "File processing error" });
    }

    // Run Python script on the new path
    // Use 'python3' as it's the standard in most nix envs for 3.x
    const pythonProcess = spawn("python3", ["server/lib/image_processor.py", newPath]);

    let dataString = "";
    let errorString = "";

    pythonProcess.stdout.on("data", (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorString += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      try {
        if (code !== 0) {
          console.error("Python script error:", errorString);
          return res.status(500).json({ message: "Image processing failed" });
        }

        const result = JSON.parse(dataString);
        
        if (result.error) {
           // Clean up file if processing failed logically
           fs.unlink(newPath, () => {}); 
           return res.status(400).json({ message: result.error });
        }

        // Save to DB with the public URL
        const publicUrl = `/uploads/${newFilename}`;
        
        const storedClassification = await storage.createClassification({
          imageUrl: publicUrl,
          detectedShape: result.detected_shape,
          containerColor: result.container_color,
          confidence: result.confidence || "Processed"
        });

        res.status(201).json(storedClassification);
      } catch (e) {
        console.error("Failed to parse python output:", e, "Data:", dataString);
        res.status(500).json({ message: "Internal server error during processing" });
      }
    });
  });

  return httpServer;
}
