import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportSummary } from "../../../api/types";
import type { AppError, AppErrorKind } from "../../../errors/types";
import { useConnectionStore } from "../../../stores/connection";
import { TooltipProvider } from "../../../ui/Tooltip";
import { ReportsPage } from "./ReportsPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as { from?: string; to?: string },
  query: {
    data: undefined as ReportSummary | undefined,
    isPending: true,
    isFetching: true,
    error: null as unknown,
    dataUpdatedAt: 0,
    refetch: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
  Link: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: Record<string, string>;
    children: ReactNode;
  }) => (
    <a href={to} data-to={to} data-search={search ? JSON.stringify(search) : ""}>
      {children}
    </a>
  ),
}));

vi.mock("../../../api/hooks/reports", () => ({
  useReportSummary: () => mocks.query,
}));

const summary: ReportSummary = {
  vehicles: 25,
  trips: 8,
  completed_trips: 1,
  active_trips: 4,
  alerts: 66,
  open_alerts: 45,
  distance_km: 10917.07,
  alerts_by_type: [
    { key: "geofence_exit", count: 31 },
    { key: "route_deviation", count: 7 },
  ],
};

function appError(kind: AppErrorKind): AppError {
  return {
    kind,
    retryable: true,
    outcome: "failed",
    context: { route: "/reports" },
    at: 0,
  };
}

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ReportsPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.search = {};
  mocks.query = {
    data: summary,
    isPending: false,
    isFetching: false,
    error: null,
    dataUpdatedAt: Date.parse("2026-11-08T12:00:00Z"),
    refetch: vi.fn(),
  };
  useConnectionStore.setState({ network: "online" });
});

afterEach(() => {
  useConnectionStore.setState({ network: "online" });
});

describe("ReportsPage", () => {
  it("renders the range, seven stats and the chart", async () => {
    mocks.search = {
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-08T00:00:00Z",
    };
    renderPage();

    expect(screen.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
    expect(screen.getByText(/1 Nov.*8 Nov/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Range, 7 days" })).toBeVisible();
    expect(screen.getByText("Completed trips")).toBeVisible();
    expect(screen.getByText("13% of trips")).toBeVisible();
    expect(screen.getByRole("img", { name: /Alerts by type/ })).toBeVisible();
    await waitFor(() => expect(document.title).toBe("Reports · Fleet Console"));
  });

  it("writes the default seven-day range once when the URL has none", () => {
    mocks.query = { ...mocks.query, data: undefined, isPending: true };
    renderPage();

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    const first = mocks.navigate.mock.calls[0]?.[0] as {
      to: string;
      search: { from: string; to: string };
      replace: boolean;
    };
    expect(first.to).toBe("/reports");
    expect(first.replace).toBe(true);
    expect(Date.parse(first.search.to) - Date.parse(first.search.from)).toBe(7 * 86_400_000);
  });

  it("explains an invalid range and offers the default back", async () => {
    const user = userEvent.setup();
    mocks.search = { from: "2026-11-01", to: "2026-11-08T00:00:00Z" };
    mocks.query = { ...mocks.query, data: undefined, isPending: false };
    renderPage();

    expect(screen.getByText("That range isn't valid")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Use last 7 days" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/reports", replace: true }),
    );
  });

  it("keeps cached stats visible offline and labels them stale", () => {
    mocks.search = {
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-08T00:00:00Z",
    };
    useConnectionStore.setState({ network: "offline" });
    renderPage();

    expect(screen.getByText(/Stale ·/)).toBeVisible();
    expect(screen.getByText("Vehicles")).toBeVisible();
    expect(screen.queryByText("Can't reach the server")).toBeNull();
  });

  it("shows a neutral offline state without a cached range", () => {
    mocks.search = {
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-08T00:00:00Z",
    };
    mocks.query = { ...mocks.query, data: undefined, isPending: false };
    useConnectionStore.setState({ network: "offline" });
    renderPage();

    expect(screen.getByText("This range isn't available offline")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("shows a region error with Retry when nothing is cached", async () => {
    const user = userEvent.setup();
    mocks.search = {
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-08T00:00:00Z",
    };
    mocks.query = {
      ...mocks.query,
      data: undefined,
      isPending: false,
      error: appError("network"),
    };
    renderPage();

    expect(screen.getByText("Can't reach the server")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.query.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cached stats and shows a refresh failure", () => {
    mocks.search = {
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-08T00:00:00Z",
    };
    mocks.query = { ...mocks.query, error: appError("server") };
    renderPage();

    expect(screen.getByText("Couldn't refresh")).toBeVisible();
    expect(screen.getByText("Vehicles")).toBeVisible();
  });

  it("renders the forbidden state for a server 403", () => {
    mocks.search = {
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-08T00:00:00Z",
    };
    mocks.query = {
      ...mocks.query,
      data: undefined,
      isPending: false,
      error: appError("forbidden"),
    };
    renderPage();

    expect(screen.getByText("You don't have access to this.")).toBeVisible();
  });

  it("opens the custom range dialog from the picker", async () => {
    const user = userEvent.setup();
    mocks.search = {
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-08T00:00:00Z",
    };
    renderPage();

    await user.click(screen.getByRole("button", { name: "Range, 7 days" }));
    await user.click(screen.getByRole("menuitem", { name: "Custom range…" }));
    expect(screen.getByRole("dialog", { name: "Report range" })).toBeVisible();
    expect(within(screen.getByRole("dialog")).getByLabelText("Start")).toBeVisible();
  });
});
