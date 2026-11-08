import { describe, expect, it } from "vitest";
import { formatEvidenceValue, humanizeEvidenceKey } from "./evidence";

describe("evidence formatting", () => {
  it("humanises keys", () => {
    expect(humanizeEvidenceKey("distance_m")).toBe("Distance m");
    expect(humanizeEvidenceKey("")).toBe("");
  });

  it("formats scalars with units and missing values", () => {
    expect(formatEvidenceValue("distance_m", 2091.58)).toBe("2091.58 m");
    expect(formatEvidenceValue("speed_kph", 96)).toBe("96 km/h");
    expect(formatEvidenceValue("limit_kph", 80)).toBe("80 km/h");
    expect(formatEvidenceValue("duration_s", 140)).toBe("140 s");
    expect(formatEvidenceValue("duration_min", 5)).toBe("5 min");
    expect(formatEvidenceValue("count", 3)).toBe("3");
    expect(formatEvidenceValue("enabled", true)).toBe("Yes");
    expect(formatEvidenceValue("enabled", false)).toBe("No");
    expect(formatEvidenceValue("missing", null)).toBe("—");
    expect(formatEvidenceValue("nothing", undefined)).toBe("—");
  });

  it("renders strings and nested values as text", () => {
    expect(formatEvidenceValue("geofence_id", "abc")).toBe("abc");
    expect(formatEvidenceValue("note", "<b>not html</b>")).toBe("<b>not html</b>");
    expect(formatEvidenceValue("nested", { a: 1 })).toBe('{"a":1}');
    expect(formatEvidenceValue("list", [1, 2])).toBe("[1,2]");
  });
});
