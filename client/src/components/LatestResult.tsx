import { Classification } from "@shared/schema";
import { ShapeBadge } from "./ShapeBadge";
import { motion } from "framer-motion";
import { CheckCircle2, Box, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LatestResultProps {
  result: Classification;
}

export function LatestResult({ result }: LatestResultProps) {
  // Determine container color style
  const containerColors: Record<string, string> = {
    "Green": "bg-green-500 shadow-green-500/30",
    "Blue": "bg-blue-500 shadow-blue-500/30",
    "Yellow": "bg-yellow-400 shadow-yellow-400/30",
    "Red": "bg-red-500 shadow-red-500/30",
  };

  const containerBg = containerColors[result.containerColor] || "bg-gray-500";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden"
    >
      <div className="flex flex-col md:grid md:grid-cols-2 gap-0">
        {/* Image Side */}
        <div className="relative aspect-video md:aspect-auto bg-muted/30 p-6 md:p-8 flex items-center justify-center overflow-hidden group">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
          
          <motion.img 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 20 }}
            src={result.imageUrl} 
            alt="Analyzed Product" 
            className="relative z-10 w-full h-full max-h-[250px] md:max-h-[300px] object-contain rounded-lg shadow-lg" 
          />
          
          {/* Overlay scan effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-primary/5 to-transparent h-[20%] w-full animate-scan z-20" />
        </div>

        {/* Data Side */}
        <div className="p-6 md:p-8 flex flex-col justify-center space-y-6 md:space-y-8 bg-card relative">
          <div className="absolute top-0 right-0 p-4">
             <span className="text-[10px] md:text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
               ID: {result.id.toString().padStart(6, '0')}
             </span>
          </div>

          <div>
            <h3 className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 md:mb-2">Analysis Complete</h3>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xl md:text-3xl font-bold text-foreground">
                {result.detectedShape}
              </span>
              <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs md:text-sm font-medium text-muted-foreground">Assigned Container</h4>
            <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl bg-secondary/50 border border-border">
              <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-lg shadow-lg flex items-center justify-center text-white", containerBg)}>
                <span className="text-lg md:text-xl font-bold">{result.category}</span>
              </div>
              <div>
                <div className="text-base md:text-lg font-bold">Container {result.category}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">{result.detectedShape} Sorting Logic</div>
              </div>
              <ArrowRight className="ml-auto w-4 h-4 md:w-5 md:h-5 text-muted-foreground/50" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-4 pt-4 border-t border-border">
             <div>
               <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">COLOR</div>
               <div className="text-xs md:text-sm font-medium truncate">{result.detectedColor}</div>
             </div>
             <div>
               <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">CONFIDENCE</div>
               <div className="text-xs md:text-sm font-medium truncate">{result.confidence || "98.5%"}</div>
             </div>
             <div>
               <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">TIME</div>
               <div className="text-xs md:text-sm font-medium truncate">
                 {new Date(result.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </div>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
