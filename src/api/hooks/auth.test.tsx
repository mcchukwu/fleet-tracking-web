import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../instance";
import { useAuthStore } from "../../auth/store";
import { useLogoutMutation } from "./auth";

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown" });
});

afterEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown" });
});

describe("useLogoutMutation", () => {
  it("clears the session even when the logout request fails", async () => {
    useAuthStore.getState().setSession(user, "token");
    vi.spyOn(api, "logout").mockRejectedValue(new TypeError("Failed to fetch"));
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useLogoutMutation(), {
      wrapper: wrapperFor(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().csrfToken).toBeNull();
    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
