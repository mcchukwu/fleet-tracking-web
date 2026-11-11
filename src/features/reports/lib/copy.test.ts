import { describe, expect, it } from "vitest";
import { reportsCopy } from "./copy";

describe("reports copy", () => {
  it("explains that the links open unscoped lists", () => {
    expect(reportsCopy.rangeNote).toContain("selected range");
    expect(reportsCopy.rangeNote).toContain("full lists");
  });

  it("distinguishes an empty range from a missing breakdown", () => {
    expect(reportsCopy.alertsEmpty.title).not.toBe(
      reportsCopy.breakdownUnavailable,
    );
    expect(reportsCopy.breakdownUnavailable).toBe(
      "The alert breakdown isn't available for this range.",
    );
  });

  it("explains that an uncached range needs a connection", () => {
    expect(reportsCopy.offlineEmpty.description).toContain("Reconnect");
    expect(reportsCopy.offlineEmpty.action).toBeUndefined();
  });

  it("offers a reset for an invalid range", () => {
    expect(reportsCopy.invalidRange.action).toBe("Use last 7 days");
  });

  it("never uses raw server wording or fails language", () => {
    const text = [
      ...Object.values(reportsCopy).flatMap((value) =>
        typeof value === "string" ? [value] : Object.values(value),
      ),
    ].join(" ");
    expect(text).not.toMatch(/error|failed|invalid input|status code/i);
  });
});
