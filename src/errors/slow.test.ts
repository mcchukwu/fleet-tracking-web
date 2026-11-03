import { describe, expect, it } from "vitest";
import { getSlowState, slowStateCopy } from "./slow";

describe("slow request states", () => {
  it("stays quiet for the first three seconds", () => {
    expect(getSlowState(0, 2_999)).toBeNull();
  });

  it("says it is working after three seconds", () => {
    expect(getSlowState(0, 3_000)).toBe("working");
    expect(slowStateCopy("working")).toBe("Still working…");
  });

  it("says it is taking longer after ten seconds", () => {
    expect(getSlowState(0, 10_000)).toBe("long");
    expect(slowStateCopy("long")).toBe("Taking longer than usual");
  });
});
