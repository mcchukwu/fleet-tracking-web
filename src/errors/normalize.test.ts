import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { ApiError, TimeoutError } from "./types";
import { normalize } from "./normalize";

const context = { route: "/map" };

function kindOf(cause: unknown, options?: { offline?: boolean; outcome?: "failed" | "unknown" }) {
  return normalize(cause, context, options);
}

describe("normalize", () => {
  it("keeps aborts quiet", () => {
    const error = kindOf(new DOMException("aborted", "AbortError"));
    expect(error.kind).toBe("aborted");
    expect(error.retryable).toBe(false);
  });

  it("prefers offline over a generic network failure", () => {
    expect(kindOf(new TypeError("Failed to fetch"), { offline: true }).kind).toBe("offline");
    expect(kindOf(new TypeError("Failed to fetch"), { offline: false }).kind).toBe("network");
  });

  it("maps a timeout", () => {
    const error = kindOf(new TimeoutError("slow"));
    expect(error.kind).toBe("timeout");
    expect(error.retryable).toBe(true);
  });

  it("maps 401 to unauthenticated", () => {
    expect(kindOf(new ApiError(401, "unauthenticated", "no session")).kind).toBe("unauthenticated");
  });

  it("maps a CSRF failure separately from forbidden", () => {
    expect(kindOf(new ApiError(403, "csrf_failed", "csrf validation failed")).kind).toBe("csrf");
    expect(kindOf(new ApiError(403, "forbidden", "forbidden")).kind).toBe("forbidden");
  });

  it("maps 400 and 422 to validation", () => {
    expect(kindOf(new ApiError(400, "invalid_input", "bad")).kind).toBe("validation");
    expect(kindOf(new ApiError(422, "invalid_input", "bad")).kind).toBe("validation");
  });

  it("maps 404, 409 and 429", () => {
    expect(kindOf(new ApiError(404, "not_found", "gone")).kind).toBe("not_found");
    expect(kindOf(new ApiError(409, "conflict", "changed")).kind).toBe("conflict");
    const limited = kindOf(new ApiError(429, "rate_limited", "slow down", 12));
    expect(limited.kind).toBe("rate_limited");
    expect(limited.retryAfterSec).toBe(12);
  });

  it("maps 500, 503 and other server errors", () => {
    expect(kindOf(new ApiError(500, "internal", "boom")).kind).toBe("server");
    expect(kindOf(new ApiError(502, "bad_gateway", "boom")).kind).toBe("unavailable");
    expect(kindOf(new ApiError(503, "unavailable", "boom")).kind).toBe("unavailable");
    expect(kindOf(new ApiError(504, "gateway_timeout", "boom")).kind).toBe("unavailable");
  });

  it("maps schema failures to contract", () => {
    expect(kindOf(new ZodError([])).kind).toBe("contract");
    expect(kindOf(new SyntaxError("Unexpected token")).kind).toBe("contract");
  });

  it("maps unknown thrown values to client", () => {
    expect(kindOf(new Error("render failed")).kind).toBe("client");
    expect(kindOf("a string").kind).toBe("client");
  });

  it("records an unknown write outcome when asked", () => {
    const error = kindOf(new TypeError("Failed to fetch"), { outcome: "unknown" });
    expect(error.outcome).toBe("unknown");
    expect(error.retryable).toBe(true);
  });

  it("passes an already normalized error through unchanged", () => {
    const first = kindOf(new ApiError(500, "internal", "boom"));
    expect(kindOf(first)).toBe(first);
  });
});
