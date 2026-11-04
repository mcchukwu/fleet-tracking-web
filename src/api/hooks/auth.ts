import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";
import { useAuthStore } from "../../auth/store";

export function meQueryOptions() {
  return {
    queryKey: queryKeys.me,
    queryFn: ({ signal }: { signal: AbortSignal }) => api.me({ signal }),
    retry: false as const,
    staleTime: 5 * 60_000,
    meta: { scope: "auth" as const, resource: "me" },
  };
}

export function useMe(options: { enabled?: boolean } = {}) {
  return useQuery({
    ...meQueryOptions(),
    enabled: options.enabled ?? true,
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    meta: { scope: "auth", resource: "/auth/login" },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => {
      useAuthStore.getState().clear();
      queryClient.clear();
    },
    meta: { scope: "auth", resource: "/auth/logout" },
  });
}
