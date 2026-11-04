import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileVehicleSheet } from "./MobileVehicleSheet";

function sheet(snap: "peek" | "half" | "full", onSnap = vi.fn()) {
  const view = render(
    <MobileVehicleSheet
      snap={snap}
      onSnap={onSnap}
      shown={25}
      total={25}
      geofencesVisible
      onFit={vi.fn()}
      onToggleGeofences={vi.fn()}
    >
      <p>List content</p>
    </MobileVehicleSheet>,
  );
  return { onSnap, view };
}

describe("MobileVehicleSheet", () => {
  it("hides the list at peek and expands on click", async () => {
    const { onSnap, view } = sheet("peek");
    expect(screen.queryByText("List content")).not.toBeInTheDocument();
    const handle = screen.getByRole("button", { name: /Showing 25 of 25/ });
    expect(handle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(handle);
    expect(onSnap).toHaveBeenCalledWith("half");

    view.rerender(
      <MobileVehicleSheet
        snap="half"
        onSnap={onSnap}
        shown={25}
        total={25}
        geofencesVisible
        onFit={vi.fn()}
        onToggleGeofences={vi.fn()}
      >
        <p>List content</p>
      </MobileVehicleSheet>,
    );
    expect(screen.getByText("List content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Showing 25 of 25/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("cycles with the keyboard and stops at the ends", async () => {
    const { onSnap } = sheet("peek");
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
});
