import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthDot } from "./HealthDot";

describe("HealthDot", () => {
  it.each([
    ["healthy", "Healthy"],
    ["warning", "Warning"],
    ["critical", "Critical"],
  ] as const)("renders the %s status with an accessible label", (tone, label) => {
    const { container } = render(<HealthDot tone={tone} label="Postgres" />);
    expect(screen.getByRole("img", { name: `Postgres: ${label}` })).toBeInTheDocument();
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
