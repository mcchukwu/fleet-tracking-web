import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../../../api/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { AuditDetailPanel } from "./AuditDetailPanel";

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

function renderPanel(
  props: Partial<Parameters<typeof AuditDetailPanel>[0]> = {},
) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <AuditDetailPanel
          entry={entry()}
          lookup="ready"
          onClose={vi.fn()}
          onRetryLookup={vi.fn()}
          {...props}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("AuditDetailPanel", () => {
  it("shows the actor, raw action, entity, identifiers and metadata as text", () => {
    renderPanel();

    expect(
      screen.getByRole("complementary", { name: "Audit entry details" }),
    ).toBeVisible();
    expect(screen.getByText("Import vehicles")).toBeVisible();
    expect(screen.getByText("Demo Dispatcher")).toBeVisible();
    expect(screen.getByText("import.vehicles")).toBeVisible();
    expect(screen.getAllByText("Import job").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Entry ID")).toBeVisible();
    expect(screen.getByText("Entity ID")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Copy entry id 207/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: /Copy entity id 00000000-0000-0000-0000-000000000401/i,
      }),
    ).toBeVisible();
    expect(screen.getByText("Imported")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });

  it("uses a local no-details line for empty metadata", () => {
    renderPanel({ entry: entry({ metadata: {} }) });
    expect(screen.getByText("No details recorded.")).toBeVisible();
    expect(screen.queryByText("No evidence recorded.")).not.toBeInTheDocument();
  });

  it("marks a missing entity id and actor without offering a copy", () => {
    renderPanel({
      entry: entry({ entity_id: "", user_name: "" }),
    });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByRole("button", { name: /Copy entity id/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the not-found, offline and error states", async () => {
    const { rerender } = renderPanel({ entry: null, lookup: "not-found" });
    expect(screen.getByText("Audit entry not found")).toBeVisible();
    expect(
      screen.getByText("It may be older than the 500 most recent entries."),
    ).toBeVisible();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AuditDetailPanel
            entry={null}
            lookup="offline"
            onClose={vi.fn()}
            onRetryLookup={vi.fn()}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("Audit entry isn't available offline")).toBeVisible();

    const retry = vi.fn();
    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AuditDetailPanel
            entry={null}
            lookup="error"
            lookupError={{
              kind: "network",
              retryable: true,
              outcome: "failed",
              context: { route: "/audit" },
              at: 0,
            }}
            onClose={vi.fn()}
            onRetryLookup={retry}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText(/Couldn't load this entry|Check your connection/i)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });

  it("focuses the close button, closes on Escape and returns focus", async () => {
    const onClose = vi.fn();
    const returnFocus = vi.fn();
    const { unmount } = renderPanel({ onClose, returnFocus });

    const close = screen.getByRole("button", { name: "Close audit entry" });
    expect(close).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();

    unmount();
    await waitFor(() => expect(returnFocus).toHaveBeenCalled());
  });
});
