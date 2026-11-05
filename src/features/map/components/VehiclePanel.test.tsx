import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { MapFilterValues, VehicleRow } from "../lib/filter";
import { VehiclePanel, type VehiclePanelProps } from "./VehiclePanel";

const filters: MapFilterValues = {
  q: "",
  statuses: [],
  depot: null,
  sort: "plate",
  onlyInView: false,
};

const row: VehicleRow = {
  id: "uuid-1",
  key: "demo-imei-0001",
  plate: "LSD-100-AA",
  driverName: "Adebayo Okafor",
  depot: "Lekki Depot",
  online: true,
  lat: 6.5,
  lon: 3.4,
  recordedAt: "2026-11-04T09:59:30Z",
  recordedAtMs: Date.parse("2026-11-04T09:59:30Z"),
  speedKph: 48,
  speedReportedAtMs: Date.parse("2026-11-04T09:59:30Z"),
  headingDeg: 90,
  status: "moving",
  freshness: "fresh",
  ageSeconds: 30,
  stale: false,
};

const forbidden: AppError = {
  kind: "forbidden",
  retryable: false,
  outcome: "failed",
  context: { route: "/map" },
  at: 0,
};

function props(overrides: Partial<VehiclePanelProps> = {}): VehiclePanelProps {
  return {
    rows: [],
    total: 0,
    positioned: 0,
    filters,
    depots: [],
    loading: false,
    error: null,
    stale: false,
    staleLabel: "—",
    selectedKey: null,
    rowHeight: 48,
    signature: "sig",
    onSelect: vi.fn(),
    onHover: vi.fn(),
    onFilterChange: vi.fn(),
    onReset: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

function renderPanel(overrides: Partial<VehiclePanelProps>) {
  return render(
    <ToastProvider>
      <TooltipProvider>
        <VehiclePanel {...props(overrides)} />
      </TooltipProvider>
    </ToastProvider>,
  );
}

describe("VehiclePanel", () => {
  it("shows a delayed skeleton while loading", async () => {
    renderPanel({ loading: true, total: 0 });
    expect(await screen.findByLabelText("Loading vehicles", {}, { timeout: 1_500 })).toBeInTheDocument();
  });

  it("distinguishes no data from no results and still lists vehicles without a position", () => {
    const { rerender } = renderPanel({ total: 0, rows: [] });
    expect(screen.getByText("No vehicles yet")).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <TooltipProvider>
          <VehiclePanel
            {...props({
              total: 2,
              positioned: 0,
              rows: [
                { ...row, lat: null, lon: null, ageSeconds: null, status: "offline" },
                { ...row, id: "uuid-2", key: "demo-imei-0002", plate: "TEST-101-AA", lat: null, lon: null },
              ],
            })}
          />
        </TooltipProvider>
      </ToastProvider>,
    );
    expect(screen.getByRole("list", { name: "Vehicles" })).toBeInTheDocument();
    expect(screen.queryByText("No vehicles are reporting a position")).not.toBeInTheDocument();

    rerender(
      <ToastProvider>
        <TooltipProvider>
          <VehiclePanel {...props({ total: 3, positioned: 2 })} />
        </TooltipProvider>
      </ToastProvider>,
    );
    expect(screen.getByText("No vehicles match these filters")).toBeInTheDocument();
  });

  it("keeps an unknown depot from the URL visible and selected", () => {
    renderPanel({
      total: 1,
      rows: [{ ...row, depot: "Closed Depot" }],
      depots: ["Lekki Depot"],
      filters: { ...filters, depot: "Closed Depot" },
    });

    expect(screen.getByLabelText("Depot")).toHaveValue("Closed Depot");
    expect(screen.getByRole("option", { name: "Closed Depot" })).toBeInTheDocument();
  });

  it("clears the filters from the no-results action", async () => {
    const onReset = vi.fn();
    renderPanel({ total: 3, positioned: 2, rows: [], onReset });
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("keeps the rows behind a refresh error with a retry", async () => {
    const onRetry = vi.fn();
    renderPanel({
      rows: [row],
      total: 1,
      positioned: 1,
      error: { ...forbidden, kind: "server", retryable: true },
      onRetry,
    });
    expect(screen.getByText("Couldn't refresh")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the forbidden state for a 403", () => {
    renderPanel({ total: 0, error: forbidden });
    expect(screen.getByText("You don't have access to this.")).toBeInTheDocument();
  });
});
