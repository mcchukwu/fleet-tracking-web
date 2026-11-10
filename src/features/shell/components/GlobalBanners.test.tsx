import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetErrorStorm, recordRequestFailure } from "../../../errors/global";
import { clearDiagnostics } from "../../../errors/report";
import { useAuthStore } from "../../../auth/store";
import { useConnectionStore } from "../../../stores/connection";
import { GlobalBanners } from "./GlobalBanners";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

function storm(): void {
  recordRequestFailure("alerts", "server");
  recordRequestFailure("vehicles", "network");
  recordRequestFailure("trips", "unavailable");
}

beforeEach(() => {
  useConnectionStore.setState({
    network: "online",
    socket: "down",
    lastDataAt: null,
    socketDownAt: null,
  });
  resetErrorStorm();
  clearDiagnostics();
});

afterEach(() => {
  useConnectionStore.setState({
    network: "online",
    socket: "down",
    lastDataAt: null,
    socketDownAt: null,
  });
  useConnectionStore.getState().setRetryLive(null);
  vi.useRealTimers();
  resetErrorStorm();
});

describe("GlobalBanners", () => {
  it("shows offline ahead of every other banner", () => {
    useConnectionStore.setState({ network: "offline", lastDataAt: null });
    storm();

    render(<GlobalBanners />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "You're offline. Changes are disabled.",
    );
    expect(
      screen.queryByText(/trouble reaching the server/),
    ).not.toBeInTheDocument();
  });

  it("includes the last data time when one exists", () => {
    useConnectionStore.setState({
      network: "offline",
      lastDataAt: new Date(2026, 10, 4, 14, 2).getTime(),
    });

    render(<GlobalBanners />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing data from 14:02",
    );
  });

  it("waits ten seconds before showing the reconnecting banner", () => {
    vi.useFakeTimers();
    useConnectionStore.setState({
      socket: "reconnecting",
      socketDownAt: Date.now(),
    });
    render(<GlobalBanners />);

    expect(
      screen.queryByText("Reconnecting to live updates…"),
    ).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reconnecting to live updates…",
    );
  });

  it("shows the error storm ahead of a reconnect", () => {
    vi.useFakeTimers();
    useConnectionStore.setState({
      socket: "reconnecting",
      socketDownAt: Date.now(),
    });
    storm();
    render(<GlobalBanners />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "We're having trouble reaching the server",
    );
  });

  it("reaches an honest terminal state after a minute of failed attempts", () => {
    vi.useFakeTimers();
    useConnectionStore.setState({
      socket: "reconnecting",
      socketDownAt: Date.now(),
      lastDataAt: new Date(2026, 10, 4, 14, 2).getTime(),
    });
    render(<GlobalBanners />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Live updates are unavailable. Showing data from 14:02.",
    );
    expect(screen.getByRole("button", { name: "Retry now" })).toBeVisible();
  });

  it("omits the data time when the terminal banner has never received data", () => {
    vi.useFakeTimers();
    useConnectionStore.setState({
      socket: "reconnecting",
      socketDownAt: Date.now(),
      lastDataAt: null,
    });
    render(<GlobalBanners />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Live updates are unavailable.",
    );
  });

  it("retries immediately and restarts the reconnect clock", () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    useConnectionStore.getState().setRetryLive(retry);
    useConnectionStore.setState({
      socket: "reconnecting",
      socketDownAt: Date.now(),
    });
    render(<GlobalBanners />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    act(() => {
      screen.getByRole("button", { name: "Retry now" }).click();
    });

    expect(retry).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().socketDownAt).toBe(Date.now());
    expect(
      screen.queryByText(/Live updates are unavailable/),
    ).not.toBeInTheDocument();
  });

  it("shows reconnecting on the next tick when it has already been down ten seconds", () => {
    vi.useFakeTimers();
    useConnectionStore.setState({
      socket: "reconnecting",
      socketDownAt: Date.now() - 11_000,
    });
    render(<GlobalBanners />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reconnecting to live updates…",
    );
  });

  it("shows the error-storm banner in the warning tone and links to System", () => {
    storm();
    render(<GlobalBanners />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(
      "We're having trouble reaching the server",
    );
    expect(banner).toHaveClass("border-idle");
    expect(screen.getByRole("button", { name: "Open System" })).toBeVisible();
  });

  it("shows the update banner when a new version is announced", () => {
    render(<GlobalBanners />);

    act(() => {
      window.dispatchEvent(new CustomEvent("fleet:update-available"));
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "A new version is available.",
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
  });

  it("shows the session-expired banner ahead of offline", () => {
    useAuthStore.setState({ status: "expired" });
    useConnectionStore.setState({ network: "offline", lastDataAt: null });
    render(<GlobalBanners />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your session expired. Sign in again.",
    );
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
    useAuthStore.setState({ status: "unknown" });
  });

  it("collapses the banner region when everything is healthy", () => {
    render(<GlobalBanners />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("banner-region")).toHaveAttribute(
      "data-visible",
      "false",
    );
  });
});
