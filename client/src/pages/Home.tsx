import { useState } from "react";
import { useClassifications, useUploadClassification } from "@/hooks/use-classifications";
import { Dropzone } from "@/components/Dropzone";
import { LatestResult } from "@/components/LatestResult";
import { ShapeBadge } from "@/components/ShapeBadge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LayoutDashboard, History, Zap, Settings2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { data: classifications, isLoading } = useClassifications();
  const { mutateAsync: uploadImage, isPending: isUploading } = useUploadClassification();
  const { toast } = useToast();
  
  const latestClassification = classifications?.[0]; 

  const handleFileSelect = async (file: File) => {
    // 1. Create immediate local preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      // 2. Start the upload/analysis
      await uploadImage(file);
      toast({
        title: "Analysis Complete",
        description: "Image has been classified and sorted.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload",
        variant: "destructive",
      });
      // Clear preview if upload fails
      setPreviewUrl(null);
    } finally {
      // Note: We don't revoke immediately here because LatestResult needs it to stay visible
      // until the real imageUrl from the server takes over or is shown.
      // But we can clean up after a small delay or when the next upload starts.
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span className="font-bold text-lg tracking-tight">ShapeSort<span className="text-primary">AI</span></span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#" className="text-foreground hover:text-primary transition-colors flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </a>
            <a href="#history" className="hover:text-primary transition-colors flex items-center gap-2">
              <History className="w-4 h-4" /> History
            </a>
            <a href="#" className="hover:text-primary transition-colors flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Settings
            </a>
          </nav>

          <div className="flex items-center gap-3">
             <div className="hidden sm:block text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
               System: ONLINE
             </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-12">
        
        {/* Hero / Upload Section */}
        <section className="grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                Automated Shape Classification
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-xl">
                Upload product images for instant shape detection and container assignment. 
                Powered by local OpenCV computer vision — no external APIs needed.
              </p>
            </div>
            
            <Dropzone onFileSelect={handleFileSelect} isProcessing={isUploading} />
          </div>

          <div className="lg:col-span-7 w-full overflow-hidden">
             {(latestClassification || previewUrl) ? (
               <div className="space-y-4">
                 <h2 className="text-lg font-semibold flex items-center gap-2">
                   <Zap className="w-4 h-4 text-primary" />
                   Live Analysis Result
                 </h2>
                 <LatestResult 
                   result={latestClassification} 
                   previewUrl={previewUrl || undefined}
                   isUploading={isUploading}
                 />
               </div>
             ) : (
               <div className="h-full min-h-[300px] md:min-h-[400px] flex flex-col items-center justify-center bg-muted/20 border-2 border-dashed border-muted rounded-2xl p-6 md:p-8 text-center">
                 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                   <LayoutDashboard className="w-8 h-8 text-muted-foreground" />
                 </div>
                 <h3 className="text-xl font-medium">Ready for Input</h3>
                 <p className="text-muted-foreground max-w-sm mt-2">
                   Upload an image to see the live classification result here. The system will detect shapes automatically.
                 </p>
               </div>
             )}
          </div>
        </section>

        {/* Recent History Table */}
        <section id="history" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Classification History</h2>
            <div className="text-sm text-muted-foreground">
              Total Processed: <span className="font-mono text-foreground font-medium">{classifications?.length || 0}</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle px-4 md:px-0">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium border-b border-border">
                    <tr>
                      <th className="px-4 md:px-6 py-4 w-[80px] md:w-[100px]">Image</th>
                      <th className="px-4 md:px-6 py-4">Shape</th>
                      <th className="px-4 md:px-6 py-4 hidden sm:table-cell">Color</th>
                      <th className="px-4 md:px-6 py-4">Container</th>
                      <th className="px-4 md:px-6 py-4 hidden lg:table-cell">Details</th>
                      <th className="px-4 md:px-6 py-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                          </div>
                        </td>
                      </tr>
                    ) : classifications?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      classifications?.map((item) => (
                        <motion.tr 
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="group hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 md:px-6 py-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white border border-border overflow-hidden relative">
                               <img 
                                 src={item.imageUrl} 
                                 alt="Thumb" 
                                 className="w-full h-full object-cover"
                               />
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4">
                            <ShapeBadge shape={item.detectedShape} />
                          </td>
                          <td className="px-4 md:px-6 py-4 font-medium hidden sm:table-cell">
                            {item.detectedColor}
                          </td>
                          <td className="px-4 md:px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs md:text-sm">
                                {item.category}
                              </div>
                              <span className="font-medium hidden xs:inline">C{item.category}</span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 text-xs text-muted-foreground max-w-[150px] md:max-w-xs truncate hidden lg:table-cell">
                            {item.reason}
                          </td>
                          <td className="px-4 md:px-6 py-4 text-right text-muted-foreground font-mono text-[10px] md:text-xs">
                            {new Date(item.createdAt || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

      </main>
      
      {/* Footer */}
      <footer className="border-t border-border bg-muted/20 py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            &copy; 2024 ShapeSort AI. Built for industrial automation.
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground">Documentation</a>
            <a href="#" className="hover:text-foreground">API Status</a>
            <a href="#" className="hover:text-foreground">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
