import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybackHeader } from "./PlaybackHeader";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    ...props
  }: {
    to: string;
    search?: Record<string, string>;
    children: React.ReactNode;
  }) => (
    <a href={`${to}?${new URLSearchParams(search).toString()}`} {...props}>
      {children}
    </a>
  ),
}));

const vehicle = {
  id: "4324a768-9b14-4223-a299-eb8da4d8d309",
  external_id: "demo-imei-0001",
  plate: "LSD-100-AA",
  depot: "Lekki Depot",
  online: true,
};

function renderHeader(overrides: Partial<Parameters<typeof PlaybackHeader>[0]> = {}) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <PlaybackHeader
          vehicle={vehicle}
          offline={false}
          onChangeVehicle={() => undefined}
          {...overrides}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("PlaybackHeader", () => {
  it("shows the plate, a copy control and a map back link with the vehicle", () => {
    renderHeader();
    expect(screen.getByRole("heading", { name: "Playback" })).toBeVisible();
    expect(screen.getByRole("button", { name: /copy plate lsd-100-aa/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /back to map/i })).toHaveAttribute(
      "href",
      expect.stringContaining("v=4324a768-9b14-4223-a299-eb8da4d8d309"),
    );
  });

  it("opens the change-vehicle dialog", async () => {
    const onChangeVehicle = vi.fn();
    renderHeader({ onChangeVehicle });
    await userEvent.click(screen.getByRole("button", { name: "Change vehicle" }));
    expect(onChangeVehicle).toHaveBeenCalled();
  });

  it("shows the offline saved-data badge with its age when known", () => {
    renderHeader({ offline: true });
    expect(screen.getByText("Offline · showing saved data")).toBeVisible();
    renderHeader({ offline: true, savedAt: Date.parse("2026-11-08T14:02:00Z") });
    expect(screen.getByText(/^Offline · showing data from \d{2}:\d{2}$/)).toBeVisible();
  });
});
