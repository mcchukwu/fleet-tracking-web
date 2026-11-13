import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Trip } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { TripTable } from "./TripTable";

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    vehicle_id: "vehicle-1",
    plate: "LSD-100-AA",
    driver_name: "Adebayo Okafor",
    origin: "Refinery Gate",
    destination: "Ibadan Customer",
    status: "active",
    distance_km: 0,
    started_at: "2026-11-09T08:00:00Z",
    ...overrides,
  };
}

function renderTable(props: Partial<Parameters<typeof TripTable>[0]> = {}) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <TripTable
          trips={[trip()]}
          state="ready"
          onRetry={vi.fn()}
          onOpen={vi.fn()}
          onAction={vi.fn()}
          pendingId={null}
          hasMore={false}
          loadingMore={false}
          onLoadMore={vi.fn()}
          emptyReason={null}
          onClearFilters={vi.fn()}
          {...props}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("TripTable", () => {
  it("renders the trip anatomy and hides distance until completion", () => {
    renderTable();

    expect(screen.getByRole("button", { name: /Open trip to Ibadan Customer/ })).toBeVisible();
    expect(screen.getByText("Adebayo Okafor")).toBeVisible();
    expect(screen.getByText("Refinery Gate")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("0.0 km")).not.toBeInTheDocument();
  });

  it("shows a completed distance and an unknown status fallback", () => {
    renderTable({
      trips: [
        trip({ status: "completed", distance_km: 2.04 }),
        trip({ id: "trip-2", status: "diverted" }),
      ],
    });

    expect(screen.getByText("2.0 km")).toBeVisible();
    const fallback = screen.getByText("Unknown status: diverted");
    expect(fallback).toBeVisible();
    expect(fallback.closest("td")).toHaveAttribute("title", "Unknown status: diverted");
    expect(fallback.closest("td")?.querySelector("[data-cell-content]")).toHaveAttribute(
      "data-truncate",
      "true",
    );
  });

  it("opens the row and fires the next action", async () => {
    const onOpen = vi.fn();
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderTable({ onOpen, onAction });

    await user.click(screen.getByRole("button", { name: /Open trip to Ibadan Customer/ }));
    expect(onOpen).toHaveBeenCalledWith("trip-1");

    await user.click(screen.getByRole("button", { name: "Complete LSD-100-AA" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "trip-1" }), "complete");
  });

  it("renders the empty copy per reason", () => {
    const { rerender } = renderTable({ trips: [], state: "empty", emptyReason: "no-data" });
    expect(screen.getByText("No trips yet")).toBeVisible();
    expect(screen.getByText("Create the first one.")).toBeVisible();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <TripTable
            trips={[]}
            state="empty"
            onRetry={vi.fn()}
            onOpen={vi.fn()}
            onAction={vi.fn()}
            pendingId={null}
            hasMore
            loadingMore={false}
            onLoadMore={vi.fn()}
            emptyReason="no-loaded-matches"
            onClearFilters={vi.fn()}
            hasLoadedRows
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("No trips match in the loaded trips")).toBeVisible();
  });

  it("shows the filtered empty state when cached rows do not match offline", () => {
    renderTable({
      trips: [],
      state: "empty",
      emptyReason: "no-results",
      offline: true,
      hasLoadedRows: true,
    });
    expect(screen.getByText("No trips match")).toBeVisible();
    expect(screen.queryByText("No trips available offline")).not.toBeInTheDocument();
  });

  it("shows the offline empty state only when nothing is cached", () => {
    renderTable({
      trips: [],
      state: "empty",
      emptyReason: "no-data",
      offline: true,
      hasLoadedRows: false,
    });
    expect(screen.getByText("No trips available offline")).toBeVisible();
  });

  it("dims the pending row", () => {
    renderTable({ pendingId: "trip-1" });
    const row = screen.getByRole("button", { name: /Open trip to Ibadan Customer/ }).closest("tr");
    expect(row?.className).toContain("opacity-60");
  });

  it("disables Load more offline", () => {
    renderTable({ hasMore: true, offline: true });
    expect(screen.getByRole("button", { name: "Load more" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("explains a cancelled load and offers Retry", () => {
    renderTable({ trips: [], state: "empty", cancelled: true });
    expect(screen.getByText("Loading cancelled")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("renders an inline action error with Retry", () => {
    const error: AppError = {
      kind: "network",
      retryable: true,
      outcome: "failed",
      context: { route: "/trips" },
      at: 0,
    };
    renderTable({
      actionError: {
        tripId: "trip-1",
        error,
        title: "It wasn't saved.",
        detail: "Try again.",
        onRetry: vi.fn(),
      },
    });

    expect(screen.getByText("It wasn't saved.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
