import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GeofenceKindBadge } from "./GeofenceKindBadge";
import { GeofenceLegend } from "./GeofenceLegend";

describe("GeofenceKindBadge", () => {
  it("shows a label and a swatch for every kind", () => {
    for (const [kind, label] of [
      ["depot", "Depot"],
      ["customer", "Customer"],
      ["restricted", "Restricted"],
      ["other", "Other"],
    ] as const) {
      const { unmount } = render(<GeofenceKindBadge kind={kind} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(document.querySelector(`[data-kind-swatch="${kind}"]`)).not.toBeNull();
      unmount();
    }
  });

  it("falls back to Other for an unknown kind", () => {
    render(<GeofenceKindBadge kind="solar" />);
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(document.querySelector('[data-kind-swatch="other"]')).not.toBeNull();
  });
});

describe("GeofenceLegend", () => {
  it("opens a keyboard-accessible list of all kinds", async () => {
    render(<GeofenceLegend />);
    const trigger = screen.getByRole("button", { name: "Geofence kinds legend" });
    await userEvent.click(trigger);
    for (const label of ["Depot", "Customer", "Restricted", "Other"]) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/diagonal hatch/)).toBeInTheDocument();
  });
});
