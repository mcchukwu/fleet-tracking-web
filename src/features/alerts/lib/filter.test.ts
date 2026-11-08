import { describe, expect, it } from "vitest";
import type { Alert } from "../../../api/types";
import {
  alertTypeOptions,
  emptyReason,
  filterAlerts,
  matchesClientFilters,
  normalizePlateQuery,
  serverFilters,
  sortNewestFirst,
} from "./filter";

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "alert-1",
    vehicle_id: "v-1",
    plate: "LSD-101-AA",
    type: "idle",
    severity: "high",
    status: "open",
    occurred_at: "2026-11-02T12:00:00Z",
    evidence: {},
    ...overrides,
  };
}

describe("alert filters", () => {
  it("sends only status and type to the server", () => {
    expect(serverFilters({ status: "open", type: "idle", severity: "high", q: "lsd" })).toEqual({
      status: "open",
      type: "idle",
    });
    expect(serverFilters({ status: null, type: null, severity: null, q: "" })).toEqual({});
  });

  it("matches severity and plate on the client, ignoring spaces and hyphens", () => {
    const values = { status: null, type: null, severity: "high" as const, q: "lsd101aa" };
    expect(normalizePlateQuery(" LSD-101-AA ")).toBe("lsd101aa");
    expect(matchesClientFilters(alert(), values)).toBe(true);
    expect(matchesClientFilters(alert({ plate: "LSD-102-AA" }), values)).toBe(false);
    expect(matchesClientFilters(alert({ severity: "low" }), values)).toBe(false);
  });

  it("keeps matching rows and sorts newest first", () => {
    const rows = [
      alert({ id: "a", occurred_at: "2026-11-02T10:00:00Z" }),
      alert({ id: "b", occurred_at: "2026-11-02T12:00:00Z" }),
      alert({ id: "c", severity: "low", occurred_at: "2026-11-02T11:00:00Z" }),
    ];
    const filtered = filterAlerts(rows, {
      status: null,
      type: null,
      severity: "high",
      q: "",
    });
    expect(filtered.map((row) => row.id)).toEqual(["b", "a"]);
    expect(sortNewestFirst(rows).map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("builds type options from known types plus loaded unknown types", () => {
    const options = alertTypeOptions([alert({ type: "solar_flare" })], "solar_flare");
    expect(options.map((option) => option.value)).toContain("geofence_enter");
    expect(options.find((option) => option.value === "solar_flare")?.label).toBe(
      "Unknown type: solar_flare",
    );
    expect(options.map((option) => option.value)).toContain("solar_flare");
  });

  it("distinguishes no data, no results and a loaded-page miss", () => {
    const none = { status: null, type: null, severity: null, q: "" };
    expect(emptyReason({ values: none, serverCount: 0, clientCount: 0, hasMore: false })).toBe(
      "no-data",
    );
    expect(
      emptyReason({
        values: { ...none, status: "open" },
        serverCount: 0,
        clientCount: 0,
        hasMore: false,
      }),
    ).toBe("no-results");
    expect(
      emptyReason({
        values: { ...none, q: "lsd" },
        serverCount: 500,
        clientCount: 0,
        hasMore: true,
      }),
    ).toBe("no-loaded-matches");
    expect(
      emptyReason({ values: none, serverCount: 3, clientCount: 2, hasMore: false }),
    ).toBeNull();
  });
});
