import { describe, expect, it } from "vitest";
import {
  fromLocalInputValue,
  isRfc3339,
  toLocalInputValue,
  validateDatetimeRange,
} from "./datetime";

describe("local datetime fields", () => {
  it("converts a local field value to a UTC instant", () => {
    expect(fromLocalInputValue("2026-11-08T14:30")).toBe(
      new Date(2026, 10, 8, 14, 30).toISOString(),
    );
  });

  it("round-trips a local field value", () => {
    const iso = new Date(2026, 10, 8, 14, 30).toISOString();
    expect(fromLocalInputValue(toLocalInputValue(iso))).toBe(iso);
  });

  it("round-trips to minute precision through the field format", () => {
    expect(toLocalInputValue(new Date(2026, 10, 8, 14, 30).toISOString())).toBe(
      "2026-11-08T14:30",
    );
  });

  it("rejects an incomplete value", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("2026-11-08")).toBeNull();
  });

  it("rejects a wall time the browser would silently roll forward", () => {
    expect(fromLocalInputValue("2026-02-30T12:00")).toBeNull();
    expect(fromLocalInputValue("2026-13-01T10:00")).toBeNull();
  });
});

describe("isRfc3339", () => {
  it("accepts a UTC instant with and without fractional seconds", () => {
    expect(isRfc3339("2026-11-08T10:00:00Z")).toBe(true);
    expect(isRfc3339("2026-11-08T10:00:00.123Z")).toBe(true);
  });

  it("accepts an explicit offset", () => {
    expect(isRfc3339("2026-11-08T11:00:00+01:00")).toBe(true);
    expect(isRfc3339("2026-11-08T04:30:00-05:30")).toBe(true);
  });

  it("rejects a date without a time", () => {
    expect(isRfc3339("2026-11-08")).toBe(false);
  });

  it("rejects a value without a zone", () => {
    expect(isRfc3339("2026-11-08T10:00:00")).toBe(false);
  });

  it("rejects malformed values and impossible calendar days", () => {
    expect(isRfc3339("nonsense")).toBe(false);
    expect(isRfc3339("2026-11-08 10:00:00Z")).toBe(false);
    expect(isRfc3339("2026-02-30T10:00:00Z")).toBe(false);
    expect(isRfc3339("2026-11-08T25:00:00Z")).toBe(false);
  });
});

describe("validateDatetimeRange", () => {
  it("returns both instants for a strict, ordered range", () => {
    const result = validateDatetimeRange(
      "2026-11-08T10:00:00Z",
      "2026-11-08T12:00:00Z",
    );
    expect(result).toMatchObject({ valid: true });
    if (!result.valid) return;
    expect(result.fromMs).toBe(Date.parse("2026-11-08T10:00:00Z"));
    expect(result.toMs).toBe(Date.parse("2026-11-08T12:00:00Z"));
  });

  it("distinguishes a missing end from an invalid one", () => {
    expect(validateDatetimeRange(undefined, "2026-11-08T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "missing",
    });
    expect(validateDatetimeRange("2026-11-08", "2026-11-08T12:00:00Z")).toMatchObject({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects equal and reversed ranges", () => {
    expect(
      validateDatetimeRange("2026-11-08T12:00:00Z", "2026-11-08T12:00:00Z"),
    ).toMatchObject({
      valid: false,
      reason: "order",
      message: "The end time must be after the start time.",
    });
    expect(
      validateDatetimeRange("2026-11-08T13:00:00Z", "2026-11-08T12:00:00Z"),
    ).toMatchObject({ valid: false, reason: "order" });
  });
});
