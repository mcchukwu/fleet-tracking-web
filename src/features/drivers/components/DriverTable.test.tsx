import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Driver } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { DriverTable } from "./DriverTable";

function driver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: "driver-1",
    name: "Adebayo Okafor",
    phone: "08031000010",
    licence: "LIC-01010",
    status: "active",
    vehicles: 2,
    ...overrides,
  };
}

function renderTable(props: Partial<Parameters<typeof DriverTable>[0]> = {}) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <DriverTable
          drivers={[driver()]}
          state="ready"
          onRetry={vi.fn()}
          onCancelLoading={vi.fn()}
          onOpen={vi.fn()}
          emptyReason={null}
          onClearFilters={vi.fn()}
          hasDrivers
          offline={false}
          cancelled={false}
          {...props}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

const serverError: AppError = {
  kind: "server",
  retryable: true,
  outcome: "failed",
  context: { route: "/drivers" },
  at: 0,
};

describe("DriverTable", () => {
  it("renders the driver anatomy with a real row-open button", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    renderTable({ onOpen });

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Phone" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Licence" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Vehicles" })).toBeVisible();
    expect(screen.getByText("Adebayo Okafor")).toBeVisible();
    expect(screen.getByRole("link", { name: "08031000010" })).toHaveAttribute(
      "href",
      "tel:08031000010",
    );
    expect(screen.getByRole("button", { name: "Copy licence LIC-01010" })).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Open driver Adebayo Okafor/ }));
    expect(onOpen).toHaveBeenCalledWith("driver-1");
  });

  it("only links a phone that can be dialled and shows a dash for missing values", () => {
    renderTable({
      drivers: [
        driver({ id: "driver-2", name: "No Contact", phone: "—", licence: "", vehicles: 0 }),
      ],
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("0")).toBeVisible();
  });

  it("renders an unknown status with the neutral fallback", () => {
    renderTable({ drivers: [driver({ status: "suspended" })] });
    expect(screen.getByText("Unknown status: suspended")).toBeVisible();
  });

  it("shows the no-data and no-results empty variants", () => {
    const { rerender } = renderTable({ drivers: [], hasDrivers: false, state: "empty", emptyReason: "no-data" });
    expect(screen.getByText("No drivers yet")).toBeVisible();
    expect(screen.getByText("Create the first one.")).toBeVisible();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <DriverTable
            drivers={[]}
            state="empty"
            onRetry={vi.fn()}
            onCancelLoading={vi.fn()}
            onOpen={vi.fn()}
            emptyReason="no-results"
            onClearFilters={vi.fn()}
            hasDrivers
            offline={false}
            cancelled={false}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("No drivers match")).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });

  it("shows the offline empty state instead of an error", () => {
    renderTable({ drivers: [], hasDrivers: false, state: "empty", offline: true });
    expect(screen.getByText("No drivers available offline")).toBeVisible();
    expect(screen.queryByText("No drivers yet")).not.toBeInTheDocument();
  });

  it("shows a cancelled load with a Retry action", () => {
    renderTable({ drivers: [], hasDrivers: false, state: "empty", cancelled: true });
    expect(screen.getByText("Loading cancelled")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("shows the region error with Retry and the forbidden state", () => {
    const { rerender } = renderTable({
      drivers: [],
      hasDrivers: false,
      state: "error",
      error: serverError,
    });
    expect(screen.getByText("Something went wrong on our side")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <DriverTable
            drivers={[]}
            state="forbidden"
            onRetry={vi.fn()}
            onCancelLoading={vi.fn()}
            onOpen={vi.fn()}
            emptyReason={null}
            onClearFilters={vi.fn()}
            hasDrivers={false}
            offline={false}
            cancelled={false}
            forbiddenAction={<a href="/map">Go back</a>}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("You don't have access to this.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go back" })).toBeVisible();
  });

  it("keeps rows and labels a failed refresh", () => {
    renderTable({ state: "error", error: serverError, staleLabel: "14:05" });
    expect(screen.getByText("Couldn't refresh")).toBeVisible();
    expect(screen.getByText("Adebayo Okafor")).toBeVisible();
  });

  it("shows the stale badge when offline with cached rows", () => {
    renderTable({ state: "stale", offline: true, staleLabel: "14:05" });
    expect(screen.getByText("Stale · 14:05")).toBeVisible();
  });
});
