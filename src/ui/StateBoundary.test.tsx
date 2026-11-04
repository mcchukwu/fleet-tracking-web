import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { StateBoundary } from "./StateBoundary";
import { recordRequestFailure, resetErrorStorm } from "../errors/global";
import type { AppError } from "../errors/types";

const requestError: AppError = {
  kind: "network",
  retryable: true,
  outcome: "failed",
  context: { route: "/alerts" },
  at: 0,
};

afterEach(() => {
  resetErrorStorm();
});

describe("StateBoundary", () => {
  it("renders a skeleton while loading", () => {
    render(<StateBoundary state="loading" />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders the empty state when there is no data", () => {
    render(<StateBoundary state="empty" empty={<p>No vehicles match</p>} />);
    expect(screen.getByText("No vehicles match")).toBeInTheDocument();
  });

  it("renders a full error with Retry when nothing is cached", async () => {
    const onRetry = vi.fn();
    render(<StateBoundary state="error" error={requestError} onRetry={onRetry} />);
    expect(screen.getByText("Can't reach the server")).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders region errors compact during an error storm", () => {
    render(<StateBoundary state="error" error={requestError} onRetry={vi.fn()} />);
    expect(screen.getByText("Can't reach the server")).toBeInTheDocument();

    act(() => {
      recordRequestFailure("alerts", "server");
      recordRequestFailure("vehicles", "network");
      recordRequestFailure("trips", "unavailable");
    });

    expect(screen.queryByText("Check your connection. Your data is safe.")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps cached content dimmed when a refresh fails", () => {    render(
      <StateBoundary state="error" error={requestError} onRetry={vi.fn()}>
        <p>cached vehicles</p>
      </StateBoundary>,
    );
    expect(screen.getByText("cached vehicles")).toBeInTheDocument();
    expect(screen.getByText("Couldn't refresh")).toBeInTheDocument();
  });

  it("labels stale data without hiding it", () => {
    render(
      <StateBoundary state="stale" staleLabel="14:02">
        <p>cached vehicles</p>
      </StateBoundary>,
    );
    expect(screen.getByText("cached vehicles")).toBeInTheDocument();
    expect(screen.getByText("Stale · 14:02")).toBeInTheDocument();
  });

  it("renders the forbidden state", () => {
    render(<StateBoundary state="forbidden" />);
    expect(screen.getByText("You don't have access to this.")).toBeInTheDocument();
  });

  it("marks a pending update without moving the layout", () => {
    render(
      <StateBoundary state="ready" pending>
        <p>row</p>
      </StateBoundary>,
    );
    expect(screen.getByText("row").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });
});
