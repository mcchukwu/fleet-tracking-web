import { describe, expect, it } from "vitest";
import { openAlertCountLabel } from "./alerts";

describe("open alert count label", () => {
  it("uses a dash while unknown and a plus at the page cap", () => {
    expect(openAlertCountLabel(undefined, 500)).toBe("—");
    expect(openAlertCountLabel(45, 500)).toBe("45");
    expect(openAlertCountLabel(500, 500)).toBe("500+");
  });
});
