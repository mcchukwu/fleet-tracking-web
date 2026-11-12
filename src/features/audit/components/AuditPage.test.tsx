import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../../../api/types";
import { resetConnection, useConnectionStore } from "../../../stores/connection";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { AuditFeedController } from "../hooks/useAuditFeed";
import { AuditPage } from "./AuditPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  feed: {} as AuditFeedController,
  lookup: {
    data: null as AuditEntry | null,
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("../hooks/useAuditFeed", () => ({
  useAuditFeed: () => mocks.feed,
}));

vi.mock("../../../api/hooks/audit", () => ({
  useAuditLookup: () => mocks.lookup,
}));

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 207,
    action: "auth.login",
    entity: "user",
    entity_id: "00000000-0000-0000-0000-000000000101",
    user_name: "Demo Admin",
    metadata: {},
    created_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

function feed(overrides: Partial<AuditFeedController> = {}): AuditFeedController {
  return {
    entries: [entry()],
    loadedCount: 1,
    hasMore: false,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    error: null,
    dataUpdatedAt: Date.now(),
    cancelled: false,
    online: true,
    loadMore: vi.fn(),
    refetch: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <AuditPage />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("AuditPage", () => {
  beforeEach(() => {
    resetConnection();
    mocks.navigate.mockReset();
    mocks.search = {};
    mocks.feed = feed();
    mocks.lookup = {
      data: null,
      isPending: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("renders the title, count, Refresh and the document title", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Audit", level: 1 })).toBeVisible();
    expect(screen.getByText("1 entry loaded")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeVisible();
    expect(document.title).toBe("Audit · Fleet Console");
  });

  it("shows the visible of loaded count when a filter is active", () => {
    mocks.search = { q: "security" };
    mocks.feed = feed({
      entries: [entry(), entry({ id: 206, user_name: "Demo Security" })],
      loadedCount: 2,
    });
    renderPage();

    expect(screen.getByText("1 of 2 loaded")).toBeVisible();
  });

  it("writes the search and action to the URL and clears the selection", async () => {
    mocks.search = { entry: "207" };
    renderPage();

    await userEvent.type(screen.getByLabelText("Search audit log"), "trip");
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        to: "/audit",
        search: { entry: undefined, q: "trip" },
        replace: true,
      }),
    );

    await userEvent.selectOptions(screen.getByLabelText("Action"), "auth.login");
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/audit",
      search: { entry: undefined, action: "auth.login" },
      replace: true,
    });
  });

  it("resets both filters and the selection", async () => {
    mocks.search = { q: "demo", action: "auth.login", entry: "207" };
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/audit",
      search: { q: undefined, action: undefined, entry: undefined },
      replace: true,
    });
  });

  it("refreshes and loads the next page through the controller", async () => {
    mocks.feed = feed({ hasMore: true });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mocks.feed.refetch).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(mocks.feed.loadMore).toHaveBeenCalled();
  });

  it("keeps cached rows offline and disables Refresh and Load more", () => {
    useConnectionStore.setState({ network: "offline" });
    mocks.feed = feed({
      online: false,
      hasMore: true,
      dataUpdatedAt: Date.parse("2026-11-12T14:05:00Z"),
    });
    renderPage();

    expect(screen.getByText("Demo Admin")).toBeVisible();
    expect(screen.getByText(/Stale ·/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Load more" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows the neutral offline state without a cache", () => {
    useConnectionStore.setState({ network: "offline" });
    mocks.feed = feed({
      online: false,
      entries: [],
      loadedCount: 0,
      hasMore: false,
    });
    renderPage();

    expect(screen.getByText("Audit isn't available offline")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows forbidden when the server rejects the role", () => {
    mocks.feed = feed({
      entries: [],
      loadedCount: 0,
      error: {
        kind: "forbidden",
        retryable: false,
        outcome: "failed",
        context: { route: "/audit" },
        at: 0,
      },
    });
    renderPage();

    expect(screen.getByText("You don't have access to this.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go back" })).toBeVisible();
    expect(screen.queryByText(/entries? loaded/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("shows a region error with Retry when nothing is cached", async () => {
    mocks.feed = feed({
      entries: [],
      loadedCount: 0,
      error: {
        kind: "server",
        retryable: true,
        outcome: "failed",
        context: { route: "/audit" },
        at: 0,
      },
    });
    renderPage();

    expect(screen.getByText("Something went wrong on our side")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.feed.refetch).toHaveBeenCalled();
  });

  it("keeps cached rows under Couldn't refresh", () => {
    mocks.feed = feed({
      dataUpdatedAt: Date.parse("2026-11-12T14:05:00Z"),
      error: {
        kind: "server",
        retryable: true,
        outcome: "failed",
        context: { route: "/audit" },
        at: 0,
      },
    });
    renderPage();

    expect(screen.getByText("Couldn't refresh")).toBeVisible();
    expect(screen.getByText(/Stale ·/)).toBeVisible();
    expect(screen.getByText("Demo Admin")).toBeVisible();
  });

  it("shows a cancelled first load with Retry", async () => {
    mocks.feed = feed({
      entries: [],
      loadedCount: 0,
      cancelled: true,
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText("Loading cancelled")).toBeVisible();
    expect(screen.queryByText("No audit entries yet")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.feed.refetch).toHaveBeenCalled();
  });

  it("opens an entry from the table by writing it to the URL", async () => {
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: /Open audit entry/i }),
    );
    const lastCall = mocks.navigate.mock.lastCall?.[0] as {
      to: string;
      search: (previous: Record<string, unknown>) => Record<string, unknown>;
      replace: boolean;
    };
    expect(lastCall.to).toBe("/audit");
    expect(lastCall.replace).toBe(false);
    expect(lastCall.search({ q: "demo" })).toEqual({ q: "demo", entry: 207 });
  });

  it("restores a deep-linked entry from the loaded rows", () => {
    mocks.search = { entry: "207" };
    renderPage();

    expect(
      screen.getByRole("complementary", { name: "Audit entry details" }),
    ).toBeVisible();
    expect(screen.getAllByText("Demo Admin").length).toBeGreaterThanOrEqual(1);
  });

  it("resolves a deep link outside the loaded rows with one lookup", () => {
    mocks.search = { entry: "999" };
    mocks.lookup = {
      data: entry({
        id: 999,
        action: "trip.create",
        entity: "trip",
        user_name: "Demo Security",
      }),
      isPending: false,
      error: null,
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByText("Create trip")).toBeVisible();
    expect(screen.getByText("Demo Security")).toBeVisible();
  });

  it("closes the drawer and returns focus to the originating row", async () => {
    mocks.search = { entry: "207" };
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Close audit entry" }),
    );
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/audit",
      search: { entry: undefined },
      replace: true,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Open audit entry/i })).toHaveFocus(),
    );
  });
});
