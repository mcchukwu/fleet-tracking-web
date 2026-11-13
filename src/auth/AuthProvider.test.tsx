import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/instance";
import { useConnectionStore } from "../stores/connection";
import { AuthProvider, handleSessionExpired } from "./AuthProvider";
import { useAuthStore } from "./store";

const mocks = vi.hoisted(() => ({
  saveOfflineProfile: vi.fn(),
  claimImportHistory: vi.fn(),
  wipeDeviceData: vi.fn(),
  startPersistedCache: vi.fn(),
  stopPersistedCache: vi.fn(),
}));

vi.mock("../lib/importHistory", () => ({
  claimImportHistory: mocks.claimImportHistory,
  wipeDeviceData: mocks.wipeDeviceData,
}));

vi.mock("./offlineProfile", () => ({
  saveOfflineProfile: mocks.saveOfflineProfile,
}));

vi.mock("../api/persistedCache", () => ({
  startPersistedCache: mocks.startPersistedCache,
  stopPersistedCache: mocks.stopPersistedCache,
}));

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

beforeEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown", sessionVerified: false });
  useConnectionStore.setState({ network: "online" });
  mocks.saveOfflineProfile.mockReset();
  mocks.saveOfflineProfile.mockResolvedValue(undefined);
  mocks.claimImportHistory.mockReset();
  mocks.claimImportHistory.mockResolvedValue(null);
  mocks.wipeDeviceData.mockReset();
  mocks.wipeDeviceData.mockResolvedValue(undefined);
  mocks.stopPersistedCache.mockReset();
  mocks.startPersistedCache.mockReset();
  mocks.startPersistedCache.mockReturnValue(vi.fn());
});

afterEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown", sessionVerified: false });
  useConnectionStore.setState({ network: "online" });
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

  it("wipes device data and stops persistence on logout", () => {
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

    expect(mocks.stopPersistedCache).toHaveBeenCalled();
    expect(mocks.wipeDeviceData).toHaveBeenCalledTimes(1);
  });

  it("restarts persistence after signing out and back in", async () => {
    useAuthStore.getState().setSession(user, "token");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.startPersistedCache).toHaveBeenCalledTimes(1));

    act(() => {
      useAuthStore.getState().clear();
    });
    act(() => {
      useAuthStore.getState().setSession(user, "token-2");
    });

    await waitFor(() => expect(mocks.startPersistedCache).toHaveBeenCalledTimes(2));
  });

  it("saves the minimal profile after a verified session", async () => {
    useAuthStore.getState().setSession(user, "token");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.saveOfflineProfile).toHaveBeenCalledWith(user));
  });

  it("verifies an unverified profile when the connection returns", async () => {
    useAuthStore.getState().setOfflineProfile(user);
    useConnectionStore.setState({ network: "offline" });
    const me = vi.spyOn(api, "me").mockResolvedValue({ user, csrf_token: "token" });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    act(() => {
      useConnectionStore.setState({ network: "online" });
    });

    await waitFor(() => expect(me).toHaveBeenCalled());
    await waitFor(() => expect(useAuthStore.getState().sessionVerified).toBe(true));
    me.mockRestore();
  });

  it("ignores a late /me response after sign-out", async () => {
    useAuthStore.getState().setOfflineProfile(user);
    useConnectionStore.setState({ network: "offline" });
    let resolveMe: (value: { user: typeof user; csrf_token: string }) => void = () => undefined;
    const me = vi.spyOn(api, "me").mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    act(() => {
      useConnectionStore.setState({ network: "online" });
    });
    await waitFor(() => expect(me).toHaveBeenCalled());

    act(() => {
      useAuthStore.getState().clear();
    });
    await act(async () => {
      resolveMe({ user, csrf_token: "late-token" });
      await Promise.resolve();
    });

    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(useAuthStore.getState().user).toBeNull();
    me.mockRestore();
  });

  it("clears the query cache when a different user signs in", async () => {
    useAuthStore.getState().setSession(user, "token");
    mocks.claimImportHistory.mockResolvedValueOnce(null).mockResolvedValueOnce("user-1");
    const queryClient = new QueryClient();
    const clear = vi.spyOn(queryClient, "clear");
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await act(async () => {
      useAuthStore
        .getState()
        .setSession({ ...user, id: "user-2", email: "admin@demo.ftb", role: "admin" }, "token-2");
    });

    await waitFor(() => expect(mocks.claimImportHistory).toHaveBeenCalledWith("user-2"));
    expect(clear).toHaveBeenCalled();
    expect(mocks.wipeDeviceData).toHaveBeenCalled();
  });

  it("claims the device history on the first user of a fresh load", async () => {
    useAuthStore
      .getState()
      .setSession({ ...user, id: "user-2", email: "admin@demo.ftb", role: "admin" }, "token-2");
    mocks.claimImportHistory.mockResolvedValue("user-1");
    const queryClient = new QueryClient();
    const clear = vi.spyOn(queryClient, "clear");
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.claimImportHistory).toHaveBeenCalledWith("user-2"));
    expect(clear).toHaveBeenCalledTimes(1);
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

    expect(mocks.wipeDeviceData).not.toHaveBeenCalled();
  });
});
