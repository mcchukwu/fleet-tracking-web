import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ContractError } from "../../../errors/types";
import { systemHealthFixture } from "../../../mocks/fixtures/untyped";
import { useConnectionStore } from "../../../stores/connection";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { SystemHealthFeed } from "../hooks/useSystemHealthFeed";
import { SystemPage } from "./SystemPage";

const mocks = vi.hoisted(() => ({
  feed: {} as SystemHealthFeed,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("../hooks/useSystemHealthFeed", () => ({
  useSystemHealthFeed: () => mocks.feed,
}));

function feed(overrides: Partial<SystemHealthFeed> = {}): SystemHealthFeed {
  return {
    data: systemHealthFixture,
    dataUpdatedAt: Date.now() - 3_000,
    isPending: false,
    isFetching: false,
    error: null,
    cancelled: false,
    online: true,
    trend: { first: null, current: null, previous: null, reset: false },
    refetch: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <TooltipProvider>
      <SystemPage />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  useConnectionStore.setState({
    network: "online",
    lastDataAt: Date.now() - 10_000,
  });
  mocks.feed = feed();
});

afterEach(() => {
  useConnectionStore.setState({ network: "online", lastDataAt: null });
});

describe("SystemPage", () => {
  it("renders the summary, updated line and all three groups", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "System health", level: 1 }),
    ).toBeVisible();
    expect(screen.getByText("All systems healthy")).toBeVisible();
    expect(screen.getByText(/Health updated/)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Dependencies", level: 2 }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Fleet", level: 2 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ingest", level: 2 })).toBeVisible();
    expect(screen.getByText("20 of 25")).toBeVisible();
    expect(screen.getByText("Received")).toBeVisible();
    expect(screen.getByText("72,180", { exact: true })).toBeVisible();
    await waitFor(() =>
      expect(document.title).toBe("System health · Fleet Console"),
    );
  });

  it("shows the skeleton after 200ms while the first load runs", async () => {
    mocks.feed = feed({
      data: undefined,
      isPending: true,
      isFetching: true,
    });
    renderPage();

    expect(
      await screen.findByLabelText("Loading system health", {}, { timeout: 2_000 }),
    ).toBeVisible();
  });

  it("keeps cached values offline with a stale label and a disabled refresh", () => {
    useConnectionStore.setState({ network: "offline" });
    mocks.feed = feed({ online: false });
    renderPage();

    expect(screen.getByText(/Stale ·/)).toBeVisible();
    expect(screen.getByText("20 of 25")).toBeVisible();
    const refresh = screen.getByRole("button", { name: "Refresh" });
    expect(refresh).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText(/Can't reach the API/)).toBeNull();
  });

  it("shows the neutral offline state without a cache and without Retry", () => {
    useConnectionStore.setState({ network: "offline" });
    mocks.feed = feed({
      data: undefined,
      online: false,
      isPending: true,
      isFetching: false,
    });
    renderPage();

    expect(
      screen.getByText("System health isn't available offline"),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("turns an unreachable first load into Can't reach the API with Retry", async () => {
    const user = userEvent.setup();
    mocks.feed = feed({
      data: undefined,
      isPending: false,
      error: new TypeError("Failed to fetch"),
    });
    renderPage();

    expect(screen.getByText("Can't reach the API")).toBeVisible();
    expect(screen.getByText("Check your connection. Your data is safe.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.feed.refetch).toHaveBeenCalledOnce();
  });

  it("keeps cached values when a refresh fails", () => {
    mocks.feed = feed({ error: new TypeError("Failed to fetch") });
    renderPage();

    expect(screen.getByText("Couldn't refresh")).toBeVisible();
    expect(screen.getByText(/Stale ·/)).toBeVisible();
    expect(screen.getByText("20 of 25")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Refresh" }),
    ).toBeNull();
  });

  it("hides the data behind the forbidden state", () => {
    mocks.feed = feed({
      data: undefined,
      isPending: false,
      error: new ApiError(403, "forbidden", "forbidden"),
    });
    renderPage();

    expect(screen.getByText("You don't have access to this.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go back" })).toBeVisible();
    expect(screen.queryByText("All systems healthy")).toBeNull();
    expect(screen.queryByText("Received")).toBeNull();
  });

  it("renders a contract failure with diagnostics", () => {
    mocks.feed = feed({
      data: undefined,
      isPending: false,
      error: new ContractError("Health did not match"),
    });
    renderPage();

    expect(
      screen.getByText("Unexpected response from the server"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy diagnostics" }),
    ).toBeVisible();
    expect(screen.queryByText("Can't reach the API")).toBeNull();
  });

  it("shows a cancelled first load with Retry", async () => {
    const user = userEvent.setup();
    mocks.feed = feed({
      data: undefined,
      isPending: true,
      isFetching: true,
      cancelled: true,
    });
    renderPage();

    const notice = screen.getByText("Loading cancelled").closest("div");
    expect(notice).not.toBeNull();
    if (!notice) throw new Error("The cancelled notice is missing");
    await user.click(within(notice).getByRole("button", { name: "Retry" }));
    expect(mocks.feed.refetch).toHaveBeenCalledOnce();
  });
});
