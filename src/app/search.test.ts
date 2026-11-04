import { describe, expect, it } from "vitest";
import {
  alertsSearchSchema,
  auditSearchSchema,
  loginSearchSchema,
  mapSearchSchema,
  playbackSearchSchema,
  reportsSearchSchema,
} from "./search";

describe("route search schemas", () => {
  it("leaves empty map filters out of the URL", () => {
    expect(mapSearchSchema.parse({})).toEqual({});
  });

  it("keeps valid map filters", () => {
    expect(mapSearchSchema.parse({ q: "LSD", status: "moving,idle", v: "demo-imei-0001" })).toEqual({
      q: "LSD",
      status: "moving,idle",
      v: "demo-imei-0001",
    });
  });

  it("falls back when a value has the wrong type", () => {
    expect(alertsSearchSchema.parse({ status: 42 }).status).toBeUndefined();
  });

  it("falls back to an automatic playback resolution", () => {
    expect(playbackSearchSchema.parse({}).resolution).toBeUndefined();
    expect(playbackSearchSchema.parse({ resolution: "5m" }).resolution).toBe("5m");
    expect(playbackSearchSchema.parse({ resolution: "nonsense" }).resolution).toBeUndefined();
  });

  it("coerces the audit offset and rejects negatives", () => {
    expect(auditSearchSchema.parse({ offset: "12" }).offset).toBe(12);
    expect(auditSearchSchema.parse({ offset: -1 }).offset).toBeUndefined();
    expect(auditSearchSchema.parse({}).offset).toBeUndefined();
  });

  it("recovers a malformed or repeated login redirect", () => {
    expect(loginSearchSchema.parse({ redirect: "/map" }).redirect).toBe("/map");
    expect(
      loginSearchSchema.parse({ redirect: ["/map", "/alerts"] }).redirect,
    ).toBeUndefined();
    expect(loginSearchSchema.parse({ redirect: 42 }).redirect).toBeUndefined();
  });

  it("keeps report ranges", () => {
    expect(reportsSearchSchema.parse({ from: "2026-11-01", to: "2026-11-03" })).toEqual({
      from: "2026-11-01",
      to: "2026-11-03",
    });
  });
});
