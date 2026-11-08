import { describe, expect, it } from "vitest";
import { errorCopy, isSafeServerCode } from "./catalog";
import type { AppError, AppErrorKind } from "./types";

const kinds: AppErrorKind[] = [
  "offline",
  "network",
  "timeout",
  "unauthenticated",
  "csrf",
  "forbidden",
  "not_found",
  "conflict",
  "validation",
  "rate_limited",
  "server",
  "unavailable",
  "contract",
  "client",
  "chunk",
  "storage",
  "map",
  "clipboard",
  "aborted",
];

function error(overrides: Partial<AppError>): AppError {
  return {
    kind: "network",
    retryable: true,
    outcome: "failed",
    context: { route: "/alerts" },
    at: 0,
    ...overrides,
  };
}

describe("error catalog", () => {
  it("has copy for every kind", () => {
    for (const kind of kinds) {
      const copy = errorCopy(error({ kind }));
      expect(copy.title.length, kind).toBeGreaterThan(0);
      expect(copy.detail.length, kind).toBeGreaterThan(0);
    }
  });

  it("interpolates the attempted action for forbidden errors", () => {
    const copy = errorCopy(error({ kind: "forbidden" }), { action: "acknowledge alerts" });
    expect(copy.detail).toContain("acknowledge alerts");
  });

  it("names the resource for not-found errors", () => {
    const copy = errorCopy(error({ kind: "not_found" }), { resource: "vehicle" });
    expect(copy.title).toBe("Vehicle not found");
  });

  it("shows a server message only for allowlisted codes", () => {
    expect(isSafeServerCode("geofence_has_events")).toBe(true);
    expect(isSafeServerCode("invalid_request")).toBe(true);
    expect(isSafeServerCode("invalid_range")).toBe(true);
    expect(isSafeServerCode("internal")).toBe(false);
    const safe = errorCopy(error({ kind: "conflict", code: "geofence_has_events", serverMessage: "It has events." }));
    expect(safe.detail).toBe("It has events.");
    const unsafe = errorCopy(error({ kind: "server", serverMessage: "panic: nil pointer" }));
    expect(unsafe.detail).not.toContain("panic");
  });

  it("asks the user to check before retrying when a write outcome is unknown", () => {
    const copy = errorCopy(error({ kind: "network", outcome: "unknown" }), { resource: "trips" });
    expect(copy.detail).toContain("couldn't confirm");
    expect(copy.detail).toContain("trips");
  });

  it("includes the retry countdown for rate limits", () => {
    expect(errorCopy(error({ kind: "rate_limited", retryAfterSec: 30 })).detail).toContain("30s");
  });
});
