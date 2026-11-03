import { describe, expect, it } from "vitest";
import { clearDiagnostics, diagnostics, recordError, shouldDedupe } from "./report";
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

  it("dedupes the same kind and key within ten seconds", () => {
    clearDiagnostics();
    expect(shouldDedupe("network", "vehicles", 1_000)).toBe(false);
    expect(shouldDedupe("network", "vehicles", 5_000)).toBe(true);
    expect(shouldDedupe("network", "vehicles", 12_000)).toBe(false);
    expect(shouldDedupe("server", "vehicles", 12_001)).toBe(false);
  });
});
