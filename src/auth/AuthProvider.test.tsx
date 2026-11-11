import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, handleSessionExpired } from "./AuthProvider";
import { useAuthStore } from "./store";

const mocks = vi.hoisted(() => ({
  clearImportHistory: vi.fn(),
}));

vi.mock("../lib/importHistory", () => ({
  clearImportHistory: mocks.clearImportHistory,
}));

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

beforeEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown" });
  mocks.clearImportHistory.mockReset();
  mocks.clearImportHistory.mockResolvedValue(undefined);
});

afterEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown" });
});

describe("session expiry handler", () => {
  it("turns a first-visit 401 into anonymous instead of expired", () => {
    handleSessionExpired();
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("expires an authenticated session", () => {
    useAuthStore.getState().setSession(user, "token");
    handleSessionExpired();
    expect(useAuthStore.getState().status).toBe("expired");
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("keeps an already expired session expired", () => {
    useAuthStore.getState().setSession(user, "token");
    useAuthStore.getState().expire();
    handleSessionExpired();
    expect(useAuthStore.getState().status).toBe("expired");
  });
});

describe("AuthProvider", () => {
  it("cancels active queries when a 401 expires the session", () => {
    useAuthStore.getState().setSession(user, "token");
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, "cancelQueries");

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    act(() => {
      handleSessionExpired();
      window.dispatchEvent(new CustomEvent("fleet:session-expired"));
    });

    expect(useAuthStore.getState().status).toBe("expired");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("clears this device's import history on logout", () => {
    useAuthStore.getState().setSession(user, "token");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    act(() => {
      useAuthStore.getState().clear();
    });

    expect(mocks.clearImportHistory).toHaveBeenCalledTimes(1);
  });

  it("clears import history when a different user signs in", () => {
    useAuthStore.getState().setSession(user, "token");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    act(() => {
      useAuthStore.getState().setSession(
        { ...user, id: "user-2", email: "admin@demo.ftb", role: "admin" },
        "token-2",
      );
    });

    expect(mocks.clearImportHistory).toHaveBeenCalledTimes(1);
  });

  it("keeps import history across a same-user session refresh", () => {
    useAuthStore.getState().setSession(user, "token");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    act(() => {
      useAuthStore.getState().setSession({ ...user, name: "Renamed" }, "token-2");
    });

    expect(mocks.clearImportHistory).not.toHaveBeenCalled();
  });
});
