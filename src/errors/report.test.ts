import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDiagnostics,
  diagnostics,
  recordError,
  recordLiveHandshakeFailure,
  recordLiveHandshakeSuccess,
  recordSessionCheckSuccess,
  shouldDedupe,
} from "./report";
import type { AppError } from "./types";

function error(overrides: Partial<AppError> = {}): AppError {
  return {
    kind: "server",
    status: 500,
    code: "internal",
    retryable: true,
    outcome: "failed",
    context: { route: "/alerts", resource: "/api/v1/alerts?status=open", action: "load alerts" },
    at: 100,
    ...overrides,
  };
}

describe("diagnostics", () => {
  it("keeps the last 50 errors in memory", () => {
    clearDiagnostics();
    for (let index = 0; index < 55; index += 1) {
      recordError(error({ at: index }));
    }
    const entries = diagnostics();
    expect(entries).toHaveLength(50);
    expect(entries[0]?.at).toBe(5);
    expect(entries.at(-1)?.at).toBe(54);
  });

  it("records the endpoint without query values", () => {
    clearDiagnostics();
    recordError(error());
    expect(diagnostics()[0]?.endpoint).toBe("/api/v1/alerts");
  });

  it("reduces a third-party URL to its path, dropping the key", () => {
    clearDiagnostics();
    recordError(
      error({
        context: {
          route: "/map",
          resource: "https://api.maptiler.com/maps/streets-v4/style.json?key=super-secret",
        },
      }),
    );
    expect(diagnostics()[0]?.endpoint).toBe("/maps/streets-v4/style.json");
    expect(JSON.stringify(diagnostics())).not.toContain("super-secret");
  });

  it("dedupes the same kind and key within ten seconds", () => {
    clearDiagnostics();
    expect(shouldDedupe("network", "vehicles", 1_000)).toBe(false);
    expect(shouldDedupe("network", "vehicles", 5_000)).toBe(true);
    expect(shouldDedupe("network", "vehicles", 12_000)).toBe(false);
    expect(shouldDedupe("server", "vehicles", 12_001)).toBe(false);
  });
});

describe("live handshake hint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    clearDiagnostics();
  });

  it("logs one hint after three rejected handshakes when /me succeeded", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("MODE", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    clearDiagnostics();
    recordSessionCheckSuccess();

    recordLiveHandshakeFailure();
    recordLiveHandshakeFailure();
    expect(warn).not.toHaveBeenCalled();

    recordLiveHandshakeFailure();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[fleet] WebSocket handshake rejected. Check WS_ALLOWED_ORIGINS and the dev proxy Origin header.",
    );

    recordLiveHandshakeFailure();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("stays silent while the session check has not succeeded", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("MODE", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    clearDiagnostics();

    recordLiveHandshakeFailure();
    recordLiveHandshakeFailure();
    recordLiveHandshakeFailure();

    expect(warn).not.toHaveBeenCalled();
  });

  it("resets the failure count after a handshake succeeds", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("MODE", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    clearDiagnostics();
    recordSessionCheckSuccess();

    recordLiveHandshakeFailure();
    recordLiveHandshakeFailure();
    recordLiveHandshakeSuccess();
    recordLiveHandshakeFailure();
    recordLiveHandshakeFailure();

    expect(warn).not.toHaveBeenCalled();
  });
});
