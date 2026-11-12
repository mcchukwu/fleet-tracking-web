import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../instance";
import type { AuditEntry } from "../types";
import { useAuditFeedQuery, useAuditLookup } from "./audit";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function row(index: number): AuditEntry {
  return {
    id: index,
    action: "auth.login",
    entity: "user",
    entity_id: `user-${index}`,
    user_name: "Demo Admin",
    metadata: {},
    created_at: new Date(Date.UTC(2026, 10, 12, 2, 0, 0) - index * 1_000).toISOString(),
  };
}

describe("audit feed query", () => {
  it("requests 100 rows, pages by offset and stops on a short page", async () => {
    const audit = vi.spyOn(api, "audit").mockImplementation((filters) => {
      const offset = filters.offset;
      const data = Array.from(
        { length: offset === 0 ? 100 : 5 },
        (_, index) => row(offset + index),
      );
      return Promise.resolve({ data, received: data.length });
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useAuditFeedQuery(), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(audit).toHaveBeenCalledWith(
      { limit: 100, offset: 0 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(audit).toHaveBeenLastCalledWith(
      { limit: 100, offset: 100 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it("keeps paging when a full page dropped a malformed row", async () => {
    const audit = vi.spyOn(api, "audit").mockImplementation((filters) => {
      const offset = filters.offset;
      if (offset === 0) {
        return Promise.resolve({
          data: Array.from({ length: 99 }, (_, index) => row(index + 1)),
          received: 100,
        });
      }
      return Promise.resolve({ data: [row(101)], received: 1 });
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useAuditFeedQuery(), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(audit).toHaveBeenLastCalledWith(
      { limit: 100, offset: 100 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe("audit lookup query", () => {
  it("stays idle without an id, finds an entry and returns null for a stranger", async () => {
    const audit = vi.spyOn(api, "audit").mockResolvedValue({ data: [row(7)], received: 1 });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const idle = renderHook(() => useAuditLookup(null), {
      wrapper: wrapperFor(queryClient),
    });
    await Promise.resolve();
    expect(audit).not.toHaveBeenCalled();
    expect(idle.result.current.fetchStatus).toBe("idle");

    const found = renderHook(() => useAuditLookup("7"), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => expect(found.result.current.data?.id).toBe(7));
    expect(audit).toHaveBeenCalledWith(
      { limit: 500, offset: 0 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    const missing = renderHook(() => useAuditLookup("999"), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => expect(missing.result.current.isSuccess).toBe(true));
    expect(missing.result.current.data).toBeNull();
  });
});
