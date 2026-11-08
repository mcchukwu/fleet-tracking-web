import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Alert } from "../../../api/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { AlertTable, type AlertTableProps } from "./AlertTable";

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  id: "alert-1",
  vehicle_id: "v-1",
  plate: "LSD-101-AA",
  type: "speeding",
  severity: "critical",
  status: "open",
  occurred_at: new Date(Date.now() - 60_000).toISOString(),
  evidence: { geofence_id: "gf-1" },
  ...overrides,
});

function renderTable(props: Partial<AlertTableProps> = {}) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <AlertTable
          alerts={[alert()]}
          state="ready"
          onRetry={() => undefined}
          onOpen={() => undefined}
          onAck={() => undefined}
          pendingId={null}
          hasMore={false}
          loadingMore={false}
          onLoadMore={() => undefined}
          newCount={0}
          onRevealNew={() => undefined}
          highlightIds={new Set()}
          emptyReason={null}
          onClearFilters={() => undefined}
          zoneFor={() => "Lekki Depot"}
          tripFor={() => null}
          onScrollTopChange={() => undefined}
          {...props}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("AlertTable", () => {
  it("renders the alert anatomy", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Plate" })).toBeInTheDocument();
    expect(screen.getByText("LSD-101-AA")).toBeVisible();
    expect(screen.getByText("Speeding")).toBeVisible();
    expect(screen.getAllByText("Critical")[0]).toBeVisible();
    expect(screen.getByText("Open")).toBeVisible();
    expect(screen.getByText("Lekki Depot")).toBeVisible();
    expect(screen.getByText("—")).toBeVisible();
  });

  it("keeps unknown enums as neutral rows", () => {
    renderTable({
      alerts: [alert({ type: "solar_flare", severity: "extreme", status: "pending" })],
    });
    expect(screen.getByText("Unknown type: solar_flare")).toBeVisible();
    expect(screen.getAllByText("Unknown severity: extreme")[0]).toBeVisible();
    expect(screen.getByText("Unknown status: pending")).toBeVisible();
  });

  it("opens the detail from the keyboard target", async () => {
    const onOpen = vi.fn();
    renderTable({ onOpen });
    await userEvent.click(screen.getByRole("button", { name: /Open alert for LSD-101-AA/ }));
    expect(onOpen).toHaveBeenCalledWith("alert-1");
  });

  it("acknowledges with the a key on the focused row", async () => {
    const onAck = vi.fn();
    renderTable({ onAck });
    screen.getByRole("button", { name: /Open alert for LSD-101-AA/ }).focus();
    await userEvent.keyboard("a");
    expect(onAck).toHaveBeenCalledWith(expect.objectContaining({ id: "alert-1" }));
  });

  it("shows a pending row and disables a viewer", async () => {
    const { rerender } = renderTable({ pendingId: "alert-1" });
    expect(
      screen.getByRole("button", { name: "Acknowledge alert for LSD-101-AA" }),
    ).toHaveAttribute("aria-busy", "true");

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AlertTable
            alerts={[alert()]}
            state="ready"
            onRetry={() => undefined}
            onOpen={() => undefined}
            onAck={() => undefined}
            pendingId={null}
            disabledReason="Viewers can't acknowledge alerts."
            hasMore={false}
            loadingMore={false}
            onLoadMore={() => undefined}
            newCount={0}
            onRevealNew={() => undefined}
            highlightIds={new Set()}
            emptyReason={null}
            onClearFilters={() => undefined}
            zoneFor={() => null}
            tripFor={() => null}
            onScrollTopChange={() => undefined}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Acknowledge alert for LSD-101-AA" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("offers acknowledge only on open alerts", () => {
    for (const status of ["acked", "closed", "pending"]) {
      const { unmount } = renderTable({ alerts: [alert({ status })] });
      expect(
        screen.queryByRole("button", { name: "Acknowledge alert for LSD-101-AA" }),
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows the full trip id with copy and tooltips the acknowledged time", () => {
    const tripId = "d72adc9e-d315-4a84-9c61-41735c005811";
    renderTable({
      alerts: [
        alert({
          status: "acked",
          acked_at: "2026-11-02T20:09:00Z",
        }),
      ],
      tripFor: () => tripId,
    });
    expect(screen.getByText(tripId)).toBeVisible();
    expect(
      screen.getByRole("button", { name: `Copy trip id ${tripId}` }),
    ).toBeVisible();
    expect(screen.getAllByTitle(/UTC/)).toHaveLength(2);
  });

  it("offers Load more only when a page is full", async () => {
    const onLoadMore = vi.fn();
    const { rerender } = renderTable({ hasMore: true, onLoadMore });
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AlertTable
            alerts={[]}
            state="empty"
            onRetry={() => undefined}
            onOpen={() => undefined}
            onAck={() => undefined}
            pendingId={null}
            hasMore={false}
            loadingMore={false}
            onLoadMore={() => undefined}
            newCount={0}
            onRevealNew={() => undefined}
            highlightIds={new Set()}
            emptyReason="no-data"
            onClearFilters={() => undefined}
            zoneFor={() => null}
            tripFor={() => null}
            onScrollTopChange={() => undefined}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("No alerts yet")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("explains a client-filter miss on a full page", () => {
    renderTable({ alerts: [], state: "empty", emptyReason: "no-loaded-matches", hasMore: true });
    expect(screen.getByText("No alerts match in the loaded alerts")).toBeVisible();
    expect(screen.getByRole("button", { name: "Load more" })).toBeVisible();
  });

  it("keeps cached rows under the refresh error line", () => {
    renderTable({
      state: "error",
      error: {
        kind: "server",
        retryable: true,
        outcome: "failed",
        context: { route: "/alerts" },
        at: 0,
      },
    });
    expect(screen.getByText("Couldn't refresh")).toBeVisible();
    const table = screen.getByRole("table");
    expect(within(table).getByText("LSD-101-AA")).toBeVisible();
  });

  it("shows the full region error when no rows are cached", () => {
    renderTable({
      alerts: [],
      state: "error",
      error: {
        kind: "server",
        retryable: true,
        outcome: "failed",
        context: { route: "/alerts" },
        at: 0,
      },
    });
    expect(screen.getByText("Something went wrong on our side")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
