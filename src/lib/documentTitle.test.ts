import { describe, expect, it } from "vitest";
import { formatDocumentTitle } from "./documentTitle";

describe("document title", () => {
  it("uses the product name alone when there is no route", () => {
    expect(formatDocumentTitle()).toBe("Fleet Console");
  });

  it("appends the route title", () => {
    expect(formatDocumentTitle("Alerts")).toBe("Alerts · Fleet Console");
  });

  it("prefixes the open alert count on alert screens", () => {
    expect(formatDocumentTitle("Alerts", 3)).toBe("(3) Alerts · Fleet Console");
    expect(formatDocumentTitle("Alerts", 0)).toBe("Alerts · Fleet Console");
  });

  it("preserves a capped count label", () => {
    expect(formatDocumentTitle("Alerts", "500+")).toBe("(500+) Alerts · Fleet Console");
    expect(formatDocumentTitle("Alerts", "0")).toBe("Alerts · Fleet Console");
    expect(formatDocumentTitle("Alerts", "")).toBe("Alerts · Fleet Console");
  });
});
