import { describe, expect, it } from "vitest";
import { loginErrorCopy } from "./copy";
import type { AppError, AppErrorKind } from "../../errors/types";

function error(kind: AppErrorKind, overrides: Partial<AppError> = {}): AppError {
  return {
    kind,
    retryable: false,
    outcome: "failed",
    context: { route: "/login", action: "sign in" },
    at: 0,
    ...overrides,
  };
}

describe("loginErrorCopy", () => {
  it("uses credential copy for a 401, never the session-expiry copy", () => {
    const copy = loginErrorCopy(error("unauthenticated"));
    expect(copy.title).toBe("Email or password is incorrect.");
    expect(copy.detail).toBe("");
    expect(`${copy.title} ${copy.detail}`).not.toContain("session expired");
  });

  it("counts down a rate limit when Retry-After is known", () => {
    expect(
      loginErrorCopy(error("rate_limited", { retryAfterSec: 30 }), { remainingSec: 12 }),
    ).toEqual({
      title: "Too many attempts",
      detail: "Try again in 12s.",
    });
    expect(loginErrorCopy(error("rate_limited", { retryAfterSec: 30 }))).toEqual({
      title: "Too many attempts",
      detail: "Try again in 30s.",
    });
  });

  it("does not invent a countdown when Retry-After is absent", () => {
    expect(loginErrorCopy(error("rate_limited"))).toEqual({
      title: "Too many attempts",
      detail: "Try again shortly.",
    });
  });

  it("tells the user when the rate limit has elapsed", () => {
    expect(
      loginErrorCopy(error("rate_limited", { retryAfterSec: 30 }), { remainingSec: 0 }).detail,
    ).toBe("You can try again now.");
  });

  it("has distinct copy for offline, network, timeout and server failures", () => {
    expect(loginErrorCopy(error("offline")).title).toBe("You're offline");
    expect(loginErrorCopy(error("network")).title).toBe("Can't reach the server");
    expect(loginErrorCopy(error("timeout")).title).toBe("This is taking too long");
    expect(loginErrorCopy(error("server")).title).toBe("Something went wrong on our side");
  });

  it("keeps connection copy when a POST has an unknown outcome", () => {
    const network = loginErrorCopy(error("network", { outcome: "unknown" }));
    expect(network.detail).toBe("Check your connection. Your data is safe.");
    expect(network.detail).not.toContain("/auth/login");

    const timeout = loginErrorCopy(error("timeout", { outcome: "unknown" }));
    expect(timeout.detail).toBe("The server didn't respond in time.");
    expect(timeout.detail).not.toContain("/auth/login");
  });

  it("shows the safe validation message and no raw text for server errors", () => {
    const validation = loginErrorCopy(
      error("validation", {
        code: "invalid_request",
        serverMessage: "email and password are required",
      }),
    );
    expect(validation.detail).toBe("email and password are required");

    const server = loginErrorCopy(
      error("server", { code: "internal", serverMessage: "panic: nil pointer" }),
    );
    expect(server.detail).not.toContain("panic");
  });
});
