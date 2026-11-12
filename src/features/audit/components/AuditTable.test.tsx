import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../../../api/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { AuditTable, type AuditTableProps } from "./AuditTable";

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 207,
    action: "import.vehicles",
    entity: "import_job",
    entity_id: "00000000-0000-0000-0000-000000000401",
    user_name: "Demo Dispatcher",
    metadata: { imported: 12, failed: 2 },
    created_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

function renderTable(props: Partial<AuditTableProps> = {}) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <AuditTable
          entries={[entry()]}
          state="ready"
          onRetry={() => undefined}
          onOpen={() => undefined}
          hasMore={false}
          loadingMore={false}
          onLoadMore={() => undefined}
          offline={false}
          emptyReason={null}
          onClearFilters={() => undefined}
          forbiddenAction={<a href="/map">Go back</a>}
          selectedId={null}
          {...props}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("AuditTable", () => {
  it("renders the six columns in order with mono, copyable ids", () => {
    renderTable();

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Time",
      "Actor",
      "Action",
      "Entity",
      "Entity ID",
      "Details",
    ]);
    expect(screen.getByText("Demo Dispatcher")).toBeVisible();
    expect(screen.getByText("Import vehicles")).toBeVisible();
    expect(screen.getByText("Import job")).toBeVisible();
    expect(screen.getByText("12 imported · 2 failed")).toBeVisible();

    const copy = screen.getByRole("button", {
      name: /Copy entity id 00000000-0000-0000-0000-000000000401/i,
    });
    expect(copy).toBeVisible();
  });

  it("shows the full raw action and details as tooltips", () => {
    renderTable();
    const actionCell = screen.getByText("Import vehicles").closest("td");
    expect(actionCell).toHaveAttribute("title", "import.vehicles");
    const detailsCell = screen.getByText("12 imported · 2 failed").closest("td");
    expect(detailsCell).toHaveAttribute("title", "12 imported · 2 failed");
  });

  it("renders the same columns and six rows while loading", async () => {
    renderTable({ state: "loading" });

    await waitFor(() =>
      expect(screen.getByLabelText("Loading audit log")).toBeInTheDocument(),
    );
    const skeleton = screen.getByLabelText("Loading audit log");
    expect(within(skeleton).getAllByRole("columnheader")).toHaveLength(6);
    expect(
      within(skeleton).getAllByRole("row", { hidden: true }).length,
    ).toBeGreaterThanOrEqual(7);
  });

  it("names each empty reason with its recovery", async () => {
    const clear = vi.fn();
    const loadMore = vi.fn();
    const { rerender } = renderTable({
      entries: [],
      state: "empty",
      emptyReason: "offline",
      onClearFilters: clear,
    });
    expect(screen.getByText("Audit isn't available offline")).toBeVisible();
    expect(
      screen.getByText("Reconnect to read the audit log. It isn't stored on this device."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AuditTable
            entries={[]}
            state="empty"
            onRetry={() => undefined}
            onOpen={() => undefined}
            hasMore
            loadingMore={false}
            onLoadMore={loadMore}
            offline={false}
            emptyReason="no-loaded-matches"
            onClearFilters={clear}
            selectedId={null}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("No matches in the loaded log")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadMore).toHaveBeenCalled();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AuditTable
            entries={[]}
            state="empty"
            onRetry={() => undefined}
            onOpen={() => undefined}
            hasMore={false}
            loadingMore={false}
            onLoadMore={loadMore}
            offline={false}
            emptyReason="no-results"
            onClearFilters={clear}
            selectedId={null}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(clear).toHaveBeenCalled();
  });

  it("shows only the cancelled state after a cancelled first load", () => {
    const retry = vi.fn();
    renderTable({
      entries: [],
      state: "empty",
      cancelled: true,
      onRetry: retry,
      emptyReason: "no-data",
    });

    expect(screen.getByText("Loading cancelled")).toBeVisible();
    expect(screen.queryByText("No audit entries yet")).not.toBeInTheDocument();
  });

  it("explains why the empty-filter Load more cannot run offline", () => {
    renderTable({
      entries: [],
      state: "empty",
      hasMore: true,
      offline: true,
      emptyReason: "no-loaded-matches",
    });

    expect(screen.getByRole("button", { name: "Load more" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows a full error with Retry when nothing is cached", () => {
    renderTable({
      entries: [],
      state: "error",
      error: {
        kind: "server",
        retryable: true,
        outcome: "failed",
        context: { route: "/audit" },
        at: 0,
      },
    });
    expect(screen.getByText("Something went wrong on our side")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("keeps cached rows under a Couldn't refresh line", () => {
    renderTable({
      state: "error",
      error: {
        kind: "server",
        retryable: true,
        outcome: "failed",
        context: { route: "/audit" },
        at: 0,
      },
      staleLabel: "14:05",
    });
    expect(screen.getByText("Couldn't refresh")).toBeVisible();
    expect(screen.getByText("Stale · 14:05")).toBeVisible();
    expect(screen.getByText("Demo Dispatcher")).toBeVisible();
  });

  it("shows the forbidden state instead of rows", () => {
    renderTable({ state: "forbidden" });
    expect(screen.getByText("You don't have access to this.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go back" })).toBeVisible();
    expect(screen.queryByText("Demo Dispatcher")).not.toBeInTheDocument();
  });

  it("offers Load more only when a page is full and explains offline", () => {
    const { rerender } = renderTable({ hasMore: true });
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AuditTable
            entries={[entry()]}
            state="ready"
            onRetry={() => undefined}
            onOpen={() => undefined}
            hasMore
            loadingMore={false}
            onLoadMore={() => undefined}
            offline
            emptyReason={null}
            onClearFilters={() => undefined}
            selectedId={null}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Load more" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AuditTable
            entries={[entry()]}
            state="ready"
            onRetry={() => undefined}
            onOpen={() => undefined}
            hasMore={false}
            loadingMore={false}
            onLoadMore={() => undefined}
            offline={false}
            emptyReason={null}
            onClearFilters={() => undefined}
            selectedId={null}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("marks the selected row and opens by button or row click, not by Copy", async () => {
    const onOpen = vi.fn();
    renderTable({ onOpen, selectedId: "207" });

    const row = screen.getByText("Demo Dispatcher").closest("tr");
    expect(row).toHaveClass("bg-accent-soft");

    const open = screen.getByRole("button", {
      name: /Open audit entry: Import vehicles by Demo Dispatcher/i,
    });
    await userEvent.click(open);
    expect(onOpen).toHaveBeenLastCalledWith(207);

    await userEvent.click(screen.getByText("Demo Dispatcher"));
    expect(onOpen).toHaveBeenCalledTimes(2);

    await userEvent.click(
      screen.getByRole("button", { name: /Copy entity id/i }),
    );
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
