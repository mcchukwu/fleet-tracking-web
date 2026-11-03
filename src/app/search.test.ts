import { describe, expect, it } from "vitest";
import {
  alertsSearchSchema,
  auditSearchSchema,
  mapSearchSchema,
  playbackSearchSchema,
  reportsSearchSchema,
} from "./search";

describe("route search schemas", () => {
  it("fills map defaults", () => {
    expect(mapSearchSchema.parse({})).toEqual({ q: "", status: "", depot: "", v: "" });
  });

  it("keeps valid map filters", () => {
    expect(mapSearchSchema.parse({ q: "LSD", status: "moving,idle", v: "demo-imei-0001" })).toEqual({
      q: "LSD",
      status: "moving,idle",
      depot: "",
      v: "demo-imei-0001",
    });
  });

  it("falls back when a value has the wrong type", () => {
    expect(alertsSearchSchema.parse({ status: 42 }).status).toBe("");
  });

  it("falls back to a known playback resolution", () => {
    expect(playbackSearchSchema.parse({}).resolution).toBe("30s");
    expect(playbackSearchSchema.parse({ resolution: "5m" }).resolution).toBe("5m");
    expect(playbackSearchSchema.parse({ resolution: "nonsense" }).resolution).toBe("30s");
  });

  it("coerces the audit offset and rejects negatives", () => {
    expect(auditSearchSchema.parse({ offset: "12" }).offset).toBe(12);
    expect(auditSearchSchema.parse({ offset: -1 }).offset).toBe(0);
    expect(auditSearchSchema.parse({}).offset).toBe(0);
  });

  it("keeps report ranges", () => {
    expect(reportsSearchSchema.parse({ from: "2026-11-01", to: "2026-11-03" })).toEqual({
      from: "2026-11-01",
      to: "2026-11-03",
    });
  });
});
