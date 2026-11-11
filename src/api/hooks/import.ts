import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import type { ImportResult } from "../types";

export interface ImportVariables {
  file: File;
  signal?: AbortSignal;
}

export function useImportVehicles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, signal }: ImportVariables) =>
      api.importVehicles(file, signal ? { signal } : {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicle"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.liveSnapshot }),
        queryClient.invalidateQueries({ queryKey: queryKeys.drivers }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.systemHealth }),
      ]);
    },
    meta: { scope: "screen", resource: "/import/vehicles" },
  });
}

export type { ImportResult };
