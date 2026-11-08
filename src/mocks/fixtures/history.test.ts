import { describe, expect, it } from "vitest";
import { GAP_VEHICLE_ID, generateHistory, MAX_GENERATED_POINTS } from "./history";

const fromMs = Date.parse("2026-11-08T14:00:00Z");
const toMs = Date.parse("2026-11-08T14:10:00Z");

describe("generateHistory", () => {
  it("uses the requested resolution step and aligned buckets", () => {
    const raw = generateHistory("vehicle", fromMs, toMs, "raw");
    const thirty = generateHistory("vehicle", fromMs, toMs, "30s");
    const five = generateHistory("vehicle", fromMs, toMs, "5m");

    expect(Date.parse(raw[1]!.t) - Date.parse(raw[0]!.t)).toBe(1_000);
    expect(Date.parse(thirty[1]!.t) - Date.parse(thirty[0]!.t)).toBe(30_000);
    expect(Date.parse(five[1]!.t) - Date.parse(five[0]!.t)).toBe(300_000);
    expect(thirty).toHaveLength(21);
    expect(five).toHaveLength(3);
  });

  it("is deterministic for the same request", () => {
    expect(generateHistory("vehicle", fromMs, toMs, "30s")).toEqual(
      generateHistory("vehicle", fromMs, toMs, "30s"),
    );
  });

  it("keeps timestamps ascending with the five point fields", () => {
    const points = generateHistory("vehicle", fromMs, toMs, "30s");
    expect(points.every((point, index) => index === 0 || Date.parse(point.t) > Date.parse(points[index - 1]!.t))).toBe(true);
    expect(points[0]).toMatchObject({
      speed_kph: expect.any(Number),
      heading_deg: expect.any(Number),
      lat: expect.any(Number),
      lon: expect.any(Number),
    });
  });

  it("omits a middle slice for the designated gap vehicle", () => {
    const normal = generateHistory("normal", fromMs, Date.parse("2026-11-08T16:00:00Z"), "30s");
    const gap = generateHistory(GAP_VEHICLE_ID, fromMs, Date.parse("2026-11-08T16:00:00Z"), "30s");
    expect(gap.length).toBeLessThan(normal.length);
    const deltas = gap.slice(1).map((point, index) => Date.parse(point.t) - Date.parse(gap[index]!.t));
    expect(Math.max(...deltas)).toBeGreaterThan(5 * 60_000);
  });

  it("caps an oversized request instead of freezing the browser", () => {
    const points = generateHistory("vehicle", 0, 7 * 86_400_000, "raw");
    expect(points.length).toBeLessThanOrEqual(MAX_GENERATED_POINTS);
  });
});
