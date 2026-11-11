import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemHealthItem } from "./SystemHealthItem";

describe("SystemHealthItem", () => {
  it("renders the status, label, value and hint", () => {
    render(
      <SystemHealthItem
        item={{
          id: "redis",
          label: "Redis",
          value: "Down",
          hint: "Dependency",
          tone: "critical",
        }}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Redis: Critical" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeVisible();
    expect(screen.getByText("Down")).toBeVisible();
    expect(screen.getByText("Dependency")).toBeVisible();
    expect(screen.getByText("Down")).toHaveClass("tabular-nums");
  });

  it("keeps the missing value as an em dash", () => {
    render(
      <SystemHealthItem
        item={{
          id: "last-report",
          label: "Last vehicle report",
          value: "—",
          hint: "No vehicle reports",
          tone: "warning",
        }}
      />,
    );
    expect(screen.getByText("—")).toBeVisible();
    expect(screen.getByText("No vehicle reports")).toBeVisible();
  });
});
