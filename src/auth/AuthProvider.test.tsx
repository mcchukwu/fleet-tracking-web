import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleSessionExpired } from "./AuthProvider";
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
