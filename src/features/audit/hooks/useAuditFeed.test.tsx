import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../api/keys";
import type { AuditEntry } from "../../../api/types";
import { resetConnection, useConnectionStore } from "../../../stores/connection";
import { useAuditFeed } from "./useAuditFeed";

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as
      | { pages: { data: AuditEntry[]; received: number }[] }
      | undefined,
    dataUpdatedAt: 0,
    isPending: false,
    isFetching: false,
    isFetchingNextPage: false,
    error: null as unknown,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/audit", () => ({
  useAuditFeedQuery: () => mocks.query,
}));

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function row(id: number, action = "auth.login"): AuditEntry {
  return {
    id,
    action,
    entity: "user",
    entity_id: `user-${id}`,
    user_name: "Demo Admin",
    metadata: {},
    created_at: new Date(Date.UTC(2026, 10, 12, 2, 0, 0) + id * 1_000).toISOString(),
  };
}

describe("useAuditFeed", () => {
  beforeEach(() => {
    resetConnection();
    mocks.query = {
      data: undefined,
      dataUpdatedAt: 0,
      isPending: false,
      isFetching: false,
      isFetchingNextPage: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    };
  });

  it("exposes the loaded count, deduplicates overlapping pages and keeps hasMore", () => {
    mocks.query.data = {
      pages: [
        { data: [row(9), row(8)], received: 2 },
        { data: [row(8, "vehicle.update"), row(7)], received: 2 },
      ],
    };
    mocks.query.hasNextPage = true;

    const queryClient = new QueryClient();
    const { result } = renderHook(() => useAuditFeed(), {
      wrapper: wrapperFor(queryClient),
    });

    expect(result.current.loadedCount).toBe(3);
    expect(result.current.entries.map((entry) => entry.id)).toEqual([9, 8, 7]);
    expect(result.current.entries[1]?.action).toBe("auth.login");
    expect(result.current.hasMore).toBe(true);
  });

  it("does not load more while a page is in flight, offline or cancelled", () => {
    mocks.query.hasNextPage = true;

    const queryClient = new QueryClient();
    const { result, rerender } = renderHook(() => useAuditFeed(), {
      wrapper: wrapperFor(queryClient),
    });

    mocks.query.isFetchingNextPage = true;
    rerender();
    act(() => result.current.loadMore());
    expect(mocks.query.fetchNextPage).not.toHaveBeenCalled();

    mocks.query.isFetchingNextPage = false;
    useConnectionStore.setState({ network: "offline" });
    rerender();
    act(() => result.current.loadMore());
    expect(mocks.query.fetchNextPage).not.toHaveBeenCalled();

    useConnectionStore.setState({ network: "online" });
    act(() => result.current.cancel());
    rerender();
    act(() => result.current.loadMore());
    expect(mocks.query.fetchNextPage).not.toHaveBeenCalled();
  });

  it("cancels the feed key, then clears the cancelled flag on refetch", async () => {
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, "cancelQueries");
    const { result } = renderHook(() => useAuditFeed(), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => result.current.cancel());
    await waitFor(() => expect(result.current.cancelled).toBe(true));
    expect(cancel).toHaveBeenCalledWith({ queryKey: queryKeys.auditFeed });

    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.cancelled).toBe(false));
    expect(mocks.query.refetch).toHaveBeenCalled();
  });

  it("reports offline and the last successful update time", () => {
    mocks.query.dataUpdatedAt = 1_000;
    useConnectionStore.setState({ network: "offline" });

    const queryClient = new QueryClient();
    const { result } = renderHook(() => useAuditFeed(), {
      wrapper: wrapperFor(queryClient),
    });

    expect(result.current.online).toBe(false);
    expect(result.current.dataUpdatedAt).toBe(1_000);
  });
});
