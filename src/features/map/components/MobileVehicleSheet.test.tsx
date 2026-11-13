import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapFilterValues } from "../lib/filter";
import { MobileVehicleSheet } from "./MobileVehicleSheet";

const filters: MapFilterValues = {
  q: "",
  statuses: [],
  depot: null,
  sort: "plate",
  onlyInView: false,
};

function renderSheet(
  snap: "peek" | "half" | "full",
  overrides: Partial<Parameters<typeof MobileVehicleSheet>[0]> = {},
) {
  const onSnap = vi.fn();
  const onChange = vi.fn();
  const insetTarget = document.createElement("div");
  const view = render(
    <MobileVehicleSheet
      snap={snap}
      onSnap={onSnap}
      shown={25}
      total={25}
      filters={filters}
      depots={["Lekki Depot"]}
      geofencesVisible
      insetTarget={{ current: insetTarget }}
      onFit={vi.fn()}
      onToggleGeofences={vi.fn()}
      onFilterChange={onChange}
      onResetFilters={vi.fn()}
      {...overrides}
    >
      <p>List content</p>
    </MobileVehicleSheet>,
  );
  return { onSnap, onChange, insetTarget, view };
}

beforeEach(() => {
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
});

describe("MobileVehicleSheet", () => {
  it("keeps the header inside the sheet at peek and expands on click", async () => {
    const { onSnap } = renderSheet("peek");
    expect(screen.getByTestId("sheet-header")).toBeInTheDocument();
    const handle = screen.getByRole("button", { name: /Showing 25 of 25/ });
    expect(handle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(handle);
    expect(onSnap).toHaveBeenCalledWith("half");
  });

  it("keeps the offscreen list inert at peek and active at half", () => {
    const { view } = renderSheet("peek");
    const content = screen.getByTestId("sheet-content");
    expect(content).toHaveAttribute("inert");
    expect(content).toHaveAttribute("aria-hidden", "true");

    view.rerender(
      <MobileVehicleSheet
        snap="half"
        onSnap={vi.fn()}
        shown={25}
        total={25}
        filters={filters}
        depots={["Lekki Depot"]}
        geofencesVisible
        onFit={vi.fn()}
        onToggleGeofences={vi.fn()}
        onFilterChange={vi.fn()}
        onResetFilters={vi.fn()}
      >
        <p>List content</p>
      </MobileVehicleSheet>,
    );
    expect(screen.getByTestId("sheet-content")).not.toHaveAttribute("inert");
  });

  it("publishes the visible height as the map inset", async () => {
    const { insetTarget, view } = renderSheet("peek");
    await waitFor(() =>
      expect(insetTarget.style.getPropertyValue("--map-inset-bottom")).toBe("113px"),
    );

    view.rerender(
      <MobileVehicleSheet
        snap="half"
        onSnap={vi.fn()}
        shown={25}
        total={25}
        filters={filters}
        depots={["Lekki Depot"]}
        geofencesVisible
        insetTarget={{ current: insetTarget }}
        onFit={vi.fn()}
        onToggleGeofences={vi.fn()}
        onFilterChange={vi.fn()}
        onResetFilters={vi.fn()}
      >
        <p>List content</p>
      </MobileVehicleSheet>,
    );
    await waitFor(() =>
      expect(insetTarget.style.getPropertyValue("--map-inset-bottom")).toBe("358px"),
    );
  });

  it("reads the sheet geometry from the design tokens", async () => {
    document.documentElement.style.setProperty("--spacing-sheet-peek", "120px");
    try {
      const { insetTarget } = renderSheet("peek");
      await waitFor(() =>
        expect(insetTarget.style.getPropertyValue("--map-inset-bottom")).toBe("120px"),
      );
    } finally {
      document.documentElement.style.removeProperty("--spacing-sheet-peek");
    }
  });

  it("snaps after a drag that starts on the header", () => {
    const { onSnap } = renderSheet("peek");
    const header = screen.getByTestId("sheet-header");

    fireEvent.pointerDown(header, { clientY: 600, pointerId: 1 });
    fireEvent.pointerUp(header, { clientY: 400, pointerId: 1 });

    expect(onSnap).toHaveBeenCalledWith("half");
  });

  it("returns to the current snap when a small drag resolves to the same snap", async () => {
    const { insetTarget, onSnap } = renderSheet("peek");
    const header = screen.getByTestId("sheet-header");
    const region = screen.getByRole("region", { name: "Vehicles" });

    fireEvent.pointerDown(header, { clientY: 600, pointerId: 1 });
    fireEvent.pointerUp(header, { clientY: 580, pointerId: 1 });

    expect(onSnap).toHaveBeenCalledWith("peek");
    expect(region.style.getPropertyValue("--sheet-visible")).toBe("113px");
    await waitFor(() =>
      expect(insetTarget.style.getPropertyValue("--map-inset-bottom")).toBe("113px"),
    );
  });

  it("returns to full when a small drag from full resolves to full", () => {
    const { insetTarget, onSnap } = renderSheet("full");
    const header = screen.getByTestId("sheet-header");

    fireEvent.pointerDown(header, { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(header, { clientY: 220, pointerId: 1 });

    expect(onSnap).toHaveBeenCalledWith("full");
    expect(insetTarget.style.getPropertyValue("--map-inset-bottom")).toBe("716px");
  });

  it("cancels a pending frame and clears the drag flag on unmount", () => {
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { view, insetTarget } = renderSheet("peek");
    const header = screen.getByTestId("sheet-header");

    fireEvent.pointerDown(header, { clientY: 600, pointerId: 1 });
    fireEvent.pointerMove(header, { clientY: 500, pointerId: 1 });
    expect(insetTarget.getAttribute("data-sheet-dragging")).toBe("true");

    view.unmount();
    expect(cancel).toHaveBeenCalledWith(1);
    expect(insetTarget.hasAttribute("data-sheet-dragging")).toBe(false);
    frame.mockRestore();
    cancel.mockRestore();
  });

  it("does not drag when the gesture starts on a sheet action", () => {
    const { onSnap } = renderSheet("peek");
    const search = screen.getByRole("searchbox", { name: "Search vehicles" });
    const header = screen.getByTestId("sheet-header");

    fireEvent.pointerDown(search, { clientY: 600, pointerId: 1, bubbles: true });
    fireEvent.pointerUp(header, { clientY: 300, pointerId: 1 });

    expect(onSnap).not.toHaveBeenCalled();
  });

  it("cancels the pointerdown default on a header drag to keep focus", () => {
    renderSheet("peek");
    const header = screen.getByTestId("sheet-header");
    const search = screen.getByRole("searchbox", { name: "Search vehicles" });

    expect(fireEvent.pointerDown(header, { clientY: 600, pointerId: 1 })).toBe(false);
    expect(fireEvent.pointerDown(search, { clientY: 600, pointerId: 2, bubbles: true })).toBe(true);
  });

  it("cycles with the keyboard and stops at the ends", async () => {
    const { onSnap } = renderSheet("peek");
    const handle = screen.getByRole("button", { name: /Showing 25 of 25/ });
    handle.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onSnap).toHaveBeenCalledWith("half");
    await userEvent.keyboard("{End}");
    expect(onSnap).toHaveBeenCalledWith("full");
    await userEvent.keyboard("{Home}");
    expect(onSnap).toHaveBeenCalledWith("peek");
    await userEvent.keyboard("{ArrowDown}");
    expect(onSnap).toHaveBeenLastCalledWith("peek");
  });

  it("collapses from full to peek and returns to the last non-full snap", async () => {
    const first = renderSheet("full");
    await userEvent.click(screen.getByRole("button", { name: /Showing 25 of 25/ }));
    expect(first.onSnap).toHaveBeenCalledWith("peek");
    first.view.unmount();

    const second = renderSheet("peek");
    await userEvent.click(screen.getByRole("button", { name: /Showing 25 of 25/ }));
    expect(second.onSnap).toHaveBeenCalledWith("half");
  });

  it("passes filter changes from the header", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSheet("peek");

    const search = screen.getByRole("searchbox", { name: "Search vehicles" });
    await user.type(search, "KJA");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ q: "KJA" }));

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Offline/ }));
    expect(onChange).toHaveBeenCalledWith({ statuses: ["offline"] });
  });
});
