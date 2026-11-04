import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/instance";
import { ApiError } from "../errors/types";
import { normalize } from "../errors/normalize";
import { ensureSession } from "./session";
import { useAuthStore } from "./store";

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

beforeEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown" });
});

afterEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, status: "unknown" });
});

describe("ensureSession", () => {
  it("restores a session once and reuses the authenticated user", async () => {
    const me = vi.spyOn(api, "me").mockResolvedValue({ user, csrf_token: "token" });

    await expect(ensureSession()).resolves.toEqual(user);
    await expect(ensureSession()).resolves.toEqual(user);

    expect(me).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("caches the anonymous result so each navigation does not re-probe", async () => {
    const me = vi
      .spyOn(api, "me")
      .mockRejectedValue(normalize(new ApiError(401, "unauthenticated", "no session")));

    await expect(ensureSession()).resolves.toBeNull();
    await expect(ensureSession()).resolves.toBeNull();

    expect(me).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("does not cache a network failure", async () => {
    const me = vi.spyOn(api, "me").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(ensureSession()).rejects.toBeInstanceOf(TypeError);
    await expect(ensureSession()).rejects.toBeInstanceOf(TypeError);

    expect(me).toHaveBeenCalledTimes(2);
  });
});
