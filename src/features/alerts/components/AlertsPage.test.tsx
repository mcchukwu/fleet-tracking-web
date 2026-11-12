import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Alert } from "../../../api/types";
import { useConnectionStore } from "../../../stores/connection";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { AlertsPage } from "./AlertsPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  canAck: true,
  feed: {
    visible: [] as Alert[],
    loadedCount: 0,
    hasMore: false,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    error: null as unknown,
    loadMore: vi.fn(),
    refetch: vi.fn(),
    cancel: vi.fn(),
    atTop: true,
    setAtTop: vi.fn(),
    newCount: 0,
    revealNew: vi.fn(),
    highlightIds: new Set<string>(),
  },
  ack: {
    acknowledge: vi.fn(),
    pendingId: null as string | null,
    error: null as unknown,
    clearError: vi.fn(),
  },
  openAlerts: {
    data: [] as Alert[],
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  lookup: {
    data: null as Alert | null,
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  geofences: {
    data: [],
    isPending: false,
    error: null as unknown,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("../../../auth/useCanMutate", async () => {
  const { useConnection } = await import("../../../stores/connection");
  return {
    useCanMutate: (_capability: string, roleReason?: string) => {
      const { network } = useConnection();
      if (!mocks.canAck) {
        return {
          allowed: false,
          roleAllowed: false,
          blockedBy: "role",
          reason: roleReason ?? "Viewers can't acknowledge alerts.",
        };
      }
      if (network === "offline") {
        return {
          allowed: false,
          roleAllowed: true,
          blockedBy: "offline",
          reason: "You're offline.",
        };
      }
      return { allowed: true, roleAllowed: true, blockedBy: null, reason: null };
    },
  };
});

vi.mock("../../../api/hooks/alerts", () => ({
  OPEN_ALERT_LIMIT: 500,
  useOpenAlerts: () => mocks.openAlerts,
  useAlertLookup: () => mocks.lookup,
}));

vi.mock("../../../api/hooks/geofences", () => ({
  useGeofences: () => mocks.geofences,
}));

vi.mock("../hooks/useAlertFeed", () => ({
  useAlertFeed: () => mocks.feed,
}));

vi.mock("../hooks/useAlertAck", () => ({
  useAlertAck: () => mocks.ack,
}));

vi.mock("./AlertDetailPanel", () => ({
  AlertDetailPanel: () => <div data-testid="alert-detail" />,
}));

vi.mock("./AlertRulesPanel", () => ({
  AlertRulesPanel: () => <div data-testid="alert-rules" />,
}));

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  id: "alert-1",
  vehicle_id: "v-1",
  plate: "LSD-101-AA",
  type: "speeding",
  severity: "critical",
  status: "open",
  occurred_at: new Date(Date.now() - 60_000).toISOString(),
  evidence: {},
  ...overrides,
});

function renderPage() {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <AlertsPage />
      </ToastProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.search = {};
  mocks.canAck = true;
  mocks.feed.visible = [alert()];
  mocks.feed.loadedCount = 1;
  mocks.feed.hasMore = false;
  mocks.feed.isLoading = false;
  mocks.feed.error = null;
  mocks.feed.newCount = 0;
  mocks.ack.acknowledge.mockResolvedValue("acked");
  mocks.ack.pendingId = null;
  mocks.ack.error = null;
  mocks.openAlerts.data = [alert(), alert({ id: "alert-2" })];
  mocks.openAlerts.error = null;
  mocks.openAlerts.refetch.mockReset();
  useConnectionStore.setState({ network: "online", lastDataAt: null });
});

describe("AlertsPage", () => {
  it("shows the counts and the document title", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Alerts" })).toBeVisible();
    expect(screen.getByTestId("alerts-page")).toHaveTextContent(
      "2 open · 1 loaded",
    );
    await waitFor(() =>
      expect(document.title).toBe("(2) Alerts · Fleet Console"),
    );
  });

  it("writes filter changes to the URL", async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "open");
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/alerts",
        replace: true,
        search: expect.objectContaining({ status: "open" }),
      }),
    );
  });

  it("switches to the rules tab and clears the selected alert", async () => {
    mocks.search = { tab: "alerts", alert: "alert-1" };
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: "Alert rules" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({ tab: "rules", alert: undefined }),
      }),
    );
  });

  it("renders the loading, empty, error and forbidden states", async () => {
    mocks.feed.visible = [];
    mocks.feed.loadedCount = 0;
    mocks.feed.isLoading = true;
    const { rerender } = renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText("Loading alerts")).toBeInTheDocument(),
    );

    mocks.feed.isLoading = false;
    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AlertsPage />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("No alerts yet")).toBeVisible();

    mocks.feed.error = {
      kind: "forbidden",
      retryable: false,
      outcome: "failed",
      context: { route: "/alerts" },
      at: 0,
    };
    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AlertsPage />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("You don't have access to this.")).toBeVisible();
  });

  it("keeps cached rows when the refresh fails", () => {
    mocks.feed.error = {
      kind: "server",
      retryable: true,
      outcome: "failed",
      context: { route: "/alerts" },
      at: 0,
    };
    renderPage();
    expect(screen.getByText("Couldn't refresh")).toBeVisible();
    expect(screen.getByText("LSD-101-AA")).toBeVisible();
  });

  it("marks the page stale while offline", () => {
    useConnectionStore.setState({ network: "offline" });
    renderPage();
    expect(screen.getByText(/Stale ·/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Acknowledge alert for LSD-101-AA" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("disables acknowledge for a viewer", () => {
    mocks.canAck = false;
    renderPage();
    expect(
      screen.getByRole("button", { name: "Acknowledge alert for LSD-101-AA" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("acknowledges from a row", async () => {
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: "Acknowledge alert for LSD-101-AA" }),
    );
    expect(mocks.ack.acknowledge).toHaveBeenCalledWith(
      expect.objectContaining({ id: "alert-1" }),
    );
  });

  it("offers a retry when the open count fails", async () => {
    mocks.openAlerts.data = [];
    mocks.openAlerts.error = new TypeError("Failed to fetch");
    renderPage();
    expect(screen.getByText(/Count unavailable/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry count" }));
    expect(mocks.openAlerts.refetch).toHaveBeenCalledTimes(1);
  });

  it("returns the list to the top when the filter signature changes", () => {
    if (typeof HTMLElement.prototype.scrollTo !== "function") {
      HTMLElement.prototype.scrollTo = () => undefined;
    }
    const scrollTo = vi.spyOn(HTMLElement.prototype, "scrollTo");
    const { rerender } = renderPage();
    scrollTo.mockClear();

    mocks.search = { status: "open" };
    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AlertsPage />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    scrollTo.mockRestore();
  });
});
