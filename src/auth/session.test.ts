import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/instance";
import { ApiError } from "../errors/types";
import { normalize } from "../errors/normalize";
import { ensureSession } from "./session";
import { useAuthStore } from "./store";
import { useConnectionStore } from "../stores/connection";

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown", sessionVerified: false });
  useConnectionStore.setState({ network: "online" });
});

afterEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown", sessionVerified: false });
  useConnectionStore.setState({ network: "online" });
});

describe("ensureSession", () => {
  it("restores a session once and reuses the authenticated user", async () => {
    const me = vi.spyOn(api, "me").mockResolvedValue({ user, csrf_token: "token" });
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).resolves.toEqual(user);
    await expect(ensureSession(queryClient)).resolves.toEqual(user);

    expect(me).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("deduplicates concurrent restores through the query client", async () => {
    const me = vi.spyOn(api, "me").mockResolvedValue({ user, csrf_token: "token" });
    const queryClient = createClient();

    const results = await Promise.all([
      ensureSession(queryClient),
      ensureSession(queryClient),
      ensureSession(queryClient),
    ]);

    expect(results).toEqual([user, user, user]);
    expect(me).toHaveBeenCalledTimes(1);
  });

  it("caches the anonymous result so each navigation does not re-probe", async () => {
    const me = vi
      .spyOn(api, "me")
      .mockRejectedValue(normalize(new ApiError(401, "unauthorized", "login required")));
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).resolves.toBeNull();
    await expect(ensureSession(queryClient)).resolves.toBeNull();

    expect(me).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("does not cache a network failure", async () => {
    const me = vi.spyOn(api, "me").mockRejectedValue(new TypeError("Failed to fetch"));
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).rejects.toBeInstanceOf(TypeError);
    await expect(ensureSession(queryClient)).rejects.toBeInstanceOf(TypeError);

    expect(me).toHaveBeenCalledTimes(2);
  });

  it("returns the offline profile without a request", async () => {
    useAuthStore.getState().setOfflineProfile(user);
    useConnectionStore.setState({ network: "offline" });
    const me = vi.spyOn(api, "me");
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).resolves.toEqual(user);
    expect(me).not.toHaveBeenCalled();
    expect(useAuthStore.getState().sessionVerified).toBe(false);
  });

  it("returns anonymous offline when there is no profile", async () => {
    useConnectionStore.setState({ network: "offline" });
    const me = vi.spyOn(api, "me");
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).resolves.toBeNull();
    expect(me).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("verifies an unverified online session once", async () => {
    useAuthStore.getState().setOfflineProfile(user);
    const me = vi.spyOn(api, "me").mockResolvedValue({ user, csrf_token: "token" });
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).resolves.toEqual(user);
    expect(me).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().sessionVerified).toBe(true);
    expect(useAuthStore.getState().csrfToken).toBe("token");
  });

  it("keeps the profile unverified when verification cannot reach the server", async () => {
    useAuthStore.getState().setOfflineProfile(user);
    vi.spyOn(api, "me").mockRejectedValue(new TypeError("Failed to fetch"));
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).resolves.toEqual(user);
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().sessionVerified).toBe(false);
  });

  it("clears an unverified profile when verification returns 401", async () => {
    useAuthStore.getState().setOfflineProfile(user);
    vi.spyOn(api, "me").mockRejectedValue(
      normalize(new ApiError(401, "unauthorized", "login required")),
    );
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("keeps an expired session expired instead of restoring it from the cache", async () => {
    useAuthStore.getState().setSession(user, "token");
    useAuthStore.getState().expire();
    const me = vi.spyOn(api, "me").mockResolvedValue({ user, csrf_token: "token" });
    const queryClient = createClient();

    await expect(ensureSession(queryClient)).resolves.toEqual(user);
    expect(me).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("expired");
  });
});
