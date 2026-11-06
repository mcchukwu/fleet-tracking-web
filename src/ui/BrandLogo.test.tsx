import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it.each(["lockup", "symbol"] as const)("renders the %s variant as a named image", (variant) => {
    render(<BrandLogo variant={variant} />);

    const logo = screen.getByRole("img", { name: "Zoro" });
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo).toHaveAttribute("focusable", "false");
    expect(logo).toHaveAttribute("fill", "currentColor");
    expect(logo).not.toHaveAttribute("width");
    expect(logo).not.toHaveAttribute("height");
    expect(logo.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("keeps the two variants distinct", () => {
    const { rerender } = render(<BrandLogo variant="lockup" />);
    const lockup = screen.getByRole("img", { name: "Zoro" }).getAttribute("viewBox");
    rerender(<BrandLogo variant="symbol" />);
    const symbol = screen.getByRole("img", { name: "Zoro" }).getAttribute("viewBox");

    expect(lockup).toBe("0 0 366.36 63.33");
    expect(symbol).toBe("0 0 113.37 63.33");
  });

  it("never hard-codes a colour", () => {
    for (const variant of ["lockup", "symbol"] as const) {
      const { container, unmount } = render(<BrandLogo variant={variant} />);
      for (const element of container.querySelectorAll("*")) {
        for (const attribute of ["fill", "stroke", "color"]) {
          const value = element.getAttribute(attribute);
          if (value) expect(value).toBe("currentColor");
        }
      }
      unmount();
    }
  });
});
