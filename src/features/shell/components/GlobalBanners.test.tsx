import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetErrorStorm, recordRequestFailure } from "../../../errors/global";
import { clearDiagnostics } from "../../../errors/report";
import { useConnectionStore } from "../../../stores/connection";
import { GlobalBanners } from "./GlobalBanners";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

function storm(): void {
  recordRequestFailure("alerts", "server");
  recordRequestFailure("vehicles", "network");
  recordRequestFailure("trips", "unavailable");
}

beforeEach(() => {
  useConnectionStore.setState({ network: "online", socket: "down", lastDataAt: null, socketDownAt: null });
  resetErrorStorm();
  clearDiagnostics();
});

afterEach(() => {
  useConnectionStore.setState({ network: "online", socket: "down", lastDataAt: null, socketDownAt: null });
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
    expect(screen.queryByText(/trouble reaching the server/)).not.toBeInTheDocument();
  });

  it("includes the last data time when one exists", () => {
    useConnectionStore.setState({
      network: "offline",
      lastDataAt: new Date(2026, 10, 4, 14, 2).getTime(),
    });

    render(<GlobalBanners />);

    expect(screen.getByRole("status")).toHaveTextContent("Showing data from 14:02");
  });

  it("waits ten seconds before showing the reconnecting banner", () => {
    vi.useFakeTimers();
    useConnectionStore.setState({ socket: "reconnecting", socketDownAt: Date.now() });
    render(<GlobalBanners />);

    expect(screen.queryByText("Reconnecting to live updates…")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting to live updates…");
  });

  it("keeps a long reconnect ahead of the error-storm banner", () => {
    vi.useFakeTimers();
    useConnectionStore.setState({ socket: "reconnecting", socketDownAt: Date.now() });
    storm();
    render(<GlobalBanners />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting to live updates…");
  });

  it("shows reconnecting on the next tick when it has already been down ten seconds", () => {
    vi.useFakeTimers();
    useConnectionStore.setState({ socket: "reconnecting", socketDownAt: Date.now() - 11_000 });
    render(<GlobalBanners />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting to live updates…");
  });

  it("shows the error-storm banner in the warning tone and links to System", () => {
    storm();
    render(<GlobalBanners />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("We're having trouble reaching the server");
    expect(banner).toHaveClass("border-idle");
    expect(screen.getByRole("button", { name: "Open System" })).toBeVisible();
  });

  it("shows the update banner when a new version is announced", () => {
    render(<GlobalBanners />);

    act(() => {
      window.dispatchEvent(new CustomEvent("fleet:update-available"));
    });

    expect(screen.getByRole("status")).toHaveTextContent("A new version is available.");
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
  });

  it("renders nothing when everything is healthy", () => {
    const { container } = render(<GlobalBanners />);
    expect(container).toBeEmptyDOMElement();
  });
});
