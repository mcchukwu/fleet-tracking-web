import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FleetMap } from "./FleetMap";
import { FakeAdapter } from "./testing/FakeAdapter";
import { contractTokens } from "./testing/adapter-contract";
import { ThemeProvider } from "../theme/ThemeProvider";
import { useTheme } from "../theme/theme-context";
import { MapError } from "../errors/types";
import type { MapVehicle } from "./types";

const vehicle: MapVehicle = {
  key: "demo-imei-0001",
  position: [3.4, 6.5],
  headingDeg: 90,
  status: "moving",
  label: "LSD-100-AA",
  selected: false,
  hovered: false,
  stale: false,
};

class FailingAdapter extends FakeAdapter {
  attempts = 0;

  override mount(): Promise<void> {
    this.attempts += 1;
    return Promise.reject(new MapError("renderer failed"));
  }
}

describe("FleetMap", () => {
  it("mounts the adapter and pushes the vehicle state", async () => {
    const adapter = new FakeAdapter();
    const { rerender, unmount } = render(
      <ThemeProvider>
        <FleetMap adapter={adapter} vehicles={[vehicle]} />
      </ThemeProvider>,
    );

    await waitFor(() => expect(adapter.vehicles).toEqual([vehicle]));
    expect(adapter.mounted).toBe(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <FleetMap adapter={adapter} vehicles={[{ ...vehicle, selected: true }]} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(adapter.vehicles[0]?.selected).toBe(true));

    unmount();
    expect(adapter.destroyCount).toBe(1);
  });

  it("shows a map-level error with Retry without throwing", async () => {
    const adapter = new FailingAdapter();
    render(
      <ThemeProvider>
        <FleetMap adapter={adapter} />
      </ThemeProvider>,
    );

    expect(await screen.findByText("The map couldn't load")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(adapter.attempts).toBe(2));
  });

  it("exposes the design tokens to the adapter", async () => {
    const adapter = new FakeAdapter();
    render(
      <ThemeProvider>
        <FleetMap adapter={adapter} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(adapter.mounted).toBe(true));
    expect(adapter.tokens?.marker.radius).toBe(contractTokens.marker.radius);
  });

  it("swaps the adapter theme when the theme changes", async () => {
    const adapter = new FakeAdapter();

    function ThemeToggle() {
      const theme = useTheme();
      return (
        <button
          type="button"
          onClick={() => theme.setMode(theme.resolved === "dark" ? "light" : "dark")}
        >
          Switch theme
        </button>
      );
    }

    render(
      <ThemeProvider>
        <ThemeToggle />
        <FleetMap adapter={adapter} />
      </ThemeProvider>,
    );

    await waitFor(() => expect(adapter.mounted).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Switch theme" }));
    await waitFor(() => expect(adapter.theme).toBe("dark"));
  });
});
