import { useState, useRef, ChangeEvent } from "react";
import { Upload, FileImage, Loader2, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function Dropzone({ onFileSelect, isProcessing }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        onFileSelect(file);
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={() => !isProcessing && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-out min-h-[300px] flex flex-col items-center justify-center p-8",
        isDragging 
          ? "border-primary bg-primary/5 scale-[1.01]" 
          : "border-border hover:border-primary/50 hover:bg-muted/30",
        isProcessing && "pointer-events-none opacity-90 cursor-wait"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        disabled={isProcessing}
      />

      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center text-center space-y-4"
          >
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <ScanLine className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-foreground">Analyzing Geometry...</h3>
              <p className="text-sm text-muted-foreground font-mono">
                Running contour detection algorithms
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center text-center space-y-4"
          >
            <div className={cn(
              "p-4 rounded-full transition-colors duration-300",
              isDragging ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            )}>
              <Upload className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-foreground">
                {isDragging ? "Drop to Analyze" : "Upload Product Image"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Drag and drop your image here, or click to browse.
                <br />
                <span className="text-xs opacity-70 mt-1 block">Supports JPG, PNG, WEBP</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Decorative corners for "tech" feel */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/20 rounded-tl-lg group-hover:border-primary/50 transition-colors" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/20 rounded-tr-lg group-hover:border-primary/50 transition-colors" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/20 rounded-bl-lg group-hover:border-primary/50 transition-colors" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/20 rounded-br-lg group-hover:border-primary/50 transition-colors" />
    </div>
  );
}
