import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AlertsByTypeChart } from "./AlertsByTypeChart";

describe("AlertsByTypeChart", () => {
  it("renders sorted bars with an accessible description", () => {
    render(
      <AlertsByTypeChart
        alertCount={66}
        items={[
          { key: "speeding", count: 4 },
          { key: "geofence_exit", count: 31 },
          { key: "route_deviation", count: 7 },
          { key: "idle", count: 0 },
        ]}
      />,
    );

    const image = screen.getByRole("img", { name: /Alerts by type/ });
    expect(image).toBeVisible();
    expect(image).toHaveAccessibleDescription(
      "Alerts by type: Geofence exit 31, Route deviation 7, Speeding 4.",
    );

    const labels = within(image)
      .getAllByTestId("chart-label")
      .map((node) => node.textContent);
    expect(labels).toEqual(["Geofence exit", "Route deviation", "Speeding"]);
    expect(within(image).queryByText("Idle")).toBeNull();
  });

  it("gives the table as a collapsible text alternative in the same order", async () => {
    const user = userEvent.setup();
    render(
      <AlertsByTypeChart
        alertCount={35}
        items={[
          { key: "speeding", count: 4 },
          { key: "geofence_exit", count: 31 },
        ]}
      />,
    );

    await user.click(screen.getByText("View data table"));
    const table = screen.getByRole("table", { name: /Alerts by type/ });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual([
      "Geofence exit",
      "Speeding",
    ]);
  });

  it("shows the zero state when the range has no alerts", () => {
    render(<AlertsByTypeChart alertCount={0} items={[]} />);
    expect(screen.getByText("No alerts in this range")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("explains a missing breakdown without claiming there were no alerts", () => {
    render(<AlertsByTypeChart alertCount={66} items={[]} />);
    expect(screen.getByText("The alert breakdown isn't available for this range.")).toBeVisible();
    expect(screen.queryByText("No alerts in this range")).toBeNull();
  });

  it("renders an unknown type with the neutral fallback", () => {
    render(<AlertsByTypeChart alertCount={2} items={[{ key: "solar_flare", count: 2 }]} />);
    expect(within(screen.getByRole("img")).getByText("Unknown type: solar_flare")).toBeVisible();
  });
});
