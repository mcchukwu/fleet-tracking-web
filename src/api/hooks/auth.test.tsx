import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../instance";
import { useAuthStore } from "../../auth/store";
import { AuthProvider } from "../../auth/AuthProvider";
import { useLoginMutation, useLogoutMutation } from "./auth";

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

const otherUser = {
  ...user,
  id: "user-2",
  email: "viewer@demo.ftb",
  name: "Demo Viewer",
  role: "viewer" as const,
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

describe("useLoginMutation", () => {
  it("stores the session only after the server confirms it", async () => {
    vi.spyOn(api, "login").mockResolvedValue({ user, csrf_token: "token" });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useLoginMutation(), {
      wrapper: wrapperFor(queryClient),
    });

    const pending = result.current.mutateAsync({ email: user.email, password: "secret" });
    expect(useAuthStore.getState().status).toBe("unknown");
    await act(async () => {
      await pending;
    });

    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().csrfToken).toBe("token");
    expect(queryClient.getQueryData(["me"])).toEqual({ user, csrf_token: "token" });
  });

  it("leaves the auth store untouched when the password is wrong", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("invalid credentials"));
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useLoginMutation(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ email: user.email, password: "wrong" })
        .catch(() => undefined);
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().status).toBe("unknown");
  });
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

describe("AuthProvider user switching", () => {
  it("clears the query cache when a different user signs in", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    act(() => {
      queryClient.setQueryData(["vehicles"], [{ id: "vehicle-1" }]);
      useAuthStore.getState().setSession(user, "token");
    });
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    act(() => {
      useAuthStore.getState().setSession(otherUser, "token");
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
