import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecentImport } from "../../../lib/importHistory";
import type { AppError } from "../../../errors/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { ImportRecentList } from "./ImportRecentList";

const entry: RecentImport = {
  jobId: "job-1",
  fileName: "vehicles.csv",
  completedAt: "2026-11-11T12:00:00Z",
  total: 12,
  imported: 11,
  failed: 1,
  errors: [{ row: 7, message: "fail" }],
};

const storageError: AppError = {
  kind: "storage",
  retryable: false,
  outcome: "failed",
  context: { route: "/import" },
  at: 0,
};

function view(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ImportRecentList", () => {
  it("labels the list as this device only", () => {
    view(
      <ImportRecentList
        entries={[]}
        state="ready"
        error={null}
        onView={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Recent imports")).toBeInTheDocument();
    expect(screen.getByText("This device")).toBeInTheDocument();
    expect(screen.getByText(/server has no import history/i)).toBeInTheDocument();
    expect(screen.getByText("No imports on this device yet.")).toBeInTheDocument();
  });

  it("opens a stored result", async () => {
    const onView = vi.fn();
    view(
      <ImportRecentList
        entries={[entry]}
        state="ready"
        error={null}
        onView={onView}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("vehicles.csv")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View result for vehicles.csv" }));
    expect(onView).toHaveBeenCalledWith(entry);
  });

  it("shows a single storage notice and retries the failed write", async () => {
    const onRetry = vi.fn();
    view(
      <ImportRecentList
        entries={[entry]}
        state="ready"
        error={storageError}
        onView={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByText("This import worked, but this device couldn't save it to Recent imports."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the storage notice on a clean device that could not save the import", async () => {
    const onRetry = vi.fn();
    view(
      <ImportRecentList
        entries={[]}
        state="ready"
        error={storageError}
        onView={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByText("This import worked, but this device couldn't save it to Recent imports."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("explains when history cannot be read at all", () => {
    view(
      <ImportRecentList
        entries={[]}
        state="error"
        error={storageError}
        onView={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Recent imports aren't available on this device.")).toBeInTheDocument();
  });

  it("shows two skeleton rows after the delay while loading", () => {
    vi.useFakeTimers();
    view(
      <ImportRecentList
        entries={[]}
        state="loading"
        error={null}
        onView={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("import-recent-loading")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId("import-recent-loading")).toBeInTheDocument();
  });
});
