import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type Classification } from "@shared/schema";

// GET /api/classifications
export function useClassifications() {
  return useQuery({
    queryKey: [api.classifications.list.path],
    queryFn: async () => {
      const res = await fetch(api.classifications.list.path);
      if (!res.ok) throw new Error("Failed to fetch classifications");
      return api.classifications.list.responses[200].parse(await res.json());
    },
    // Poll every 5 seconds to keep table fresh if multiple users are working
    refetchInterval: 5000, 
  });
}

// POST /api/classifications
export function useUploadClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(api.classifications.create.path, {
        method: api.classifications.create.method,
        body: formData,
        // Don't set Content-Type header manually for FormData, browser does it
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to classify image");
      }

      return api.classifications.create.responses[201].parse(await res.json());
    },
    onSuccess: (newClassification) => {
      // Invalidate list to show new item
      queryClient.invalidateQueries({ queryKey: [api.classifications.list.path] });
    },
  });
}
