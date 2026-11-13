import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Geofence } from "../../../api/types";
import type { MutatePermission } from "../../../auth/useCanMutate";
import type { AppError } from "../../../errors/types";
import { GeofenceList, type GeofenceListProps } from "./GeofenceList";

function permission(overrides: Partial<MutatePermission> = {}): MutatePermission {
  return {
    allowed: true,
    roleAllowed: true,
    blockedBy: null,
    reason: null,
    ...overrides,
  };
}

const rows: Geofence[] = [
  {
    id: "gf-1",
    name: "Border",
    kind: "depot",
    geometry: { type: "Polygon", coordinates: [] },
  },
  {
    id: "gf-2",
    name: "Ibadan Customer",
    kind: "customer",
    geometry: { type: "Polygon", coordinates: [] },
  },
];

const networkError: AppError = {
  kind: "network",
  retryable: true,
  outcome: "failed",
  context: { route: "/geofences" },
  at: 0,
};

function renderList(overrides: Partial<GeofenceListProps> = {}) {
  const props: GeofenceListProps = {
    geofences: rows,
    total: rows.length,
    q: "",
    selected: null,
    state: "ready",
    cancelled: false,
    offline: false,
    mutate: permission(),
    notFound: false,
    onSearch: vi.fn(),
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCreate: vi.fn(),
    onClearSelection: vi.fn(),
    onRetry: vi.fn(),
    onCancelLoading: vi.fn(),
    ...overrides,
  };
  return render(<GeofenceList {...props} />);
}

describe("GeofenceList", () => {
  it("renders every row with the search field and no global shortcut hint", () => {
    renderList();
    expect(screen.getByRole("searchbox", { name: "Search geofences" })).toBeInTheDocument();
    expect(screen.queryByText("/")).toBeNull();
    expect(screen.getByRole("list", { name: "Geofences" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Border/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ibadan Customer/ })).toBeInTheDocument();
  });

  it("selects a row", async () => {
    const onSelect = vi.fn();
    renderList({ onSelect });
    await userEvent.click(screen.getByRole("button", { name: /Border/ }));
    expect(onSelect).toHaveBeenCalledWith("gf-1");
  });

  it("emits a debounced search", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderList({ onSearch });
    const input = screen.getByRole("searchbox", { name: "Search geofences" });
    fireEvent.change(input, { target: { value: "lekki" } });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(onSearch).toHaveBeenCalledWith("lekki");
    vi.useRealTimers();
  });

  it("explains the no-results state and clears the search", async () => {
    const onSearch = vi.fn();
    renderList({ geofences: [], q: "lekki", state: "empty", onSearch });
    expect(screen.getByText('No geofences match "lekki".')).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear search" })[1] as HTMLElement,
    );
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("offers creation when the tenant has no geofences", async () => {
    const onCreate = vi.fn();
    renderList({ geofences: [], total: 0, onCreate, state: "empty" });
    expect(screen.getByText("No geofences yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create geofence" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("hides creation from a read-only role", () => {
    renderList({
      geofences: [],
      total: 0,
      mutate: permission({ allowed: false, roleAllowed: false, blockedBy: "role" }),
      state: "empty",
    });
    expect(screen.getByText("No geofences have been created.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create geofence" })).toBeNull();
  });

  it("uses a neutral offline empty state", () => {
    renderList({ geofences: [], total: 0, offline: true, state: "empty" });
    expect(screen.getByText("No geofences available offline")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the not-found notice with a clear action", async () => {
    const onClearSelection = vi.fn();
    renderList({ notFound: true, onClearSelection });
    expect(screen.getByText("This geofence no longer exists.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it("retries a first-load error", async () => {
    const onRetry = vi.fn();
    renderList({ geofences: [], total: 0, state: "error", error: networkError, onRetry });
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps cached rows visible on a refresh error", () => {
    renderList({ state: "error", error: networkError });
    expect(screen.getByText("Couldn't refresh")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Border/ })).toBeInTheDocument();
  });
});
