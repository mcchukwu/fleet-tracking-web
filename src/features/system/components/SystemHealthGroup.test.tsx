import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HealthItem } from "../lib/health";
import { SystemHealthGroup } from "./SystemHealthGroup";

const items: HealthItem[] = [
  { id: "redis", label: "Redis", value: "Down", tone: "critical" },
  { id: "postgres", label: "Postgres", value: "Up", tone: "healthy" },
];

describe("SystemHealthGroup", () => {
  it("renders a labelled section, description and items in order", () => {
    render(
      <SystemHealthGroup
        id="dependencies"
        title="Dependencies"
        description="Services the API depends on."
        items={items}
        columns={2}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Dependencies", level: 2 }),
    ).toBeVisible();
    expect(screen.getByText("Services the API depends on.")).toBeVisible();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("data-health-id"))).toEqual([
      "redis",
      "postgres",
    ]);
    expect(rows[0]).toHaveAttribute("data-health-tone", "critical");
  });

  it("renders a group-level empty line instead of a strip", () => {
    render(
      <SystemHealthGroup
        id="dependencies"
        title="Dependencies"
        items={[]}
        columns={2}
      />,
    );
    expect(screen.getByText("No dependencies reported.")).toBeVisible();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
