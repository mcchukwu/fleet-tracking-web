import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../instance";
import { queryKeys } from "../keys";

export function useMe(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.me({ signal }),
    retry: false,
    staleTime: 5 * 60_000,
    meta: { scope: "auth", resource: "me" },
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
    onSettled: () => queryClient.clear(),
    meta: { scope: "auth", resource: "/auth/logout" },
  });
}
