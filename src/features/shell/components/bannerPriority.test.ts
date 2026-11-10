import { describe, expect, it } from "vitest";
import { BANNER_PRIORITY, highestPriorityBanner } from "./bannerPriority";

describe("banner priority", () => {
  it("orders every kind from session expiry to update", () => {
    expect(BANNER_PRIORITY).toEqual([
      "session-expired",
      "offline",
      "unavailable",
      "storm",
      "reconnecting",
      "update",
    ]);
  });

  it("returns the highest present kind regardless of insertion order", () => {
    expect(
      highestPriorityBanner(["update", "reconnecting", "offline", "storm"]),
    ).toBe("offline");
    expect(highestPriorityBanner(["update", "storm", "reconnecting"])).toBe(
      "storm",
    );
    expect(highestPriorityBanner(["update", "reconnecting"])).toBe(
      "reconnecting",
    );
    expect(highestPriorityBanner(["update"])).toBe("update");
  });

  it("returns null when nothing is present", () => {
    expect(highestPriorityBanner([])).toBeNull();
  });
});
