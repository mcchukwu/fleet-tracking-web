import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Trip } from "../../../api/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { TripRowActions } from "./TripRowActions";

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    vehicle_id: "vehicle-1",
    plate: "LSD-100-AA",
    origin: "Refinery Gate",
    destination: "Ibadan Customer",
    status: "planned",
    distance_km: 0,
    ...overrides,
  };
}

describe("TripRowActions", () => {
  it("offers Assign driver and Cancel for an unassigned planned trip", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<TripRowActions trip={trip()} pending={false} onAction={onAction} />);

    await user.click(screen.getByRole("button", { name: "Assign driver LSD-100-AA" }));
    expect(onAction).toHaveBeenCalledWith("assign");

    await user.click(screen.getByRole("button", { name: "Cancel trip for LSD-100-AA" }));
    expect(onAction).toHaveBeenCalledWith("cancel");
  });

  it("offers Start for an assigned trip and Complete for an active trip", () => {
    const { rerender } = render(
      <TripRowActions trip={trip({ status: "assigned" })} pending={false} onAction={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Start LSD-100-AA" })).toBeVisible();

    rerender(
      <TripRowActions trip={trip({ status: "active" })} pending={false} onAction={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Complete LSD-100-AA" })).toBeVisible();
  });

  it("offers nothing for terminal or unknown statuses", () => {
    const { container, rerender } = render(
      <TripRowActions trip={trip({ status: "completed" })} pending={false} onAction={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <TripRowActions trip={trip({ status: "diverted" })} pending={false} onAction={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a disabled reason and blocks the action", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <TripRowActions
          trip={trip({ status: "active" })}
          pending={false}
          disabledReason="Your role can't change trips."
          onAction={onAction}
        />
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Complete LSD-100-AA" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.click(button);
    expect(onAction).not.toHaveBeenCalled();
  });
});
