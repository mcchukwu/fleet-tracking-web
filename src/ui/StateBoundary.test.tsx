import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";import { StateBoundary } from "./StateBoundary";
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
  it("renders a skeleton only after 200ms", () => {
    vi.useFakeTimers();
    render(<StateBoundary state="loading" />);
    expect(screen.queryByLabelText("Loading")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("distinguishes no data yet from no results", () => {
    const { rerender } = render(<StateBoundary state="empty" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();

    rerender(<StateBoundary state="empty" emptyReason="no-results" />);
    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet")).toBeNull();
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

    expect(
      screen.queryByText("Check your connection. Your data is safe."),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps cached content dimmed when a refresh fails", () => {
    render(
      <StateBoundary state="error" error={requestError} onRetry={vi.fn()} staleLabel="14:02">
        <p>cached vehicles</p>
      </StateBoundary>,
    );
    expect(screen.getByText("cached vehicles")).toBeInTheDocument();
    expect(screen.getByText("Couldn't refresh")).toBeInTheDocument();
    expect(screen.getByText("Stale · 14:02")).toBeInTheDocument();
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

  it("renders the forbidden state with a way back when given one", () => {
    render(
      <StateBoundary
        state="forbidden"
        forbiddenAction={<a href="/map">Back to the map</a>}
      />,
    );
    expect(screen.getByText("You don't have access to this.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the map" })).toBeInTheDocument();
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
