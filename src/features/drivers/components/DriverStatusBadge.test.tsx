import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DriverStatusBadge } from "./DriverStatusBadge";

describe("DriverStatusBadge", () => {
  it("shows a filled circle and the Active label", () => {
    const { container } = render(<DriverStatusBadge status="active" />);
    expect(screen.getByText("Active")).toBeVisible();
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("fill-current");
  });

  it("shows a hollow circle and the Inactive label", () => {
    const { container } = render(<DriverStatusBadge status="inactive" />);
    expect(screen.getByText("Inactive")).toBeVisible();
    expect(container.querySelector("svg")?.getAttribute("class")).not.toContain("fill-current");
  });

  it("keeps an unknown status readable instead of failing", () => {
    render(<DriverStatusBadge status="suspended" />);
    expect(screen.getByText("Unknown status: suspended")).toBeVisible();
  });
});
