import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useConnectionStore } from "../stores/connection";
import { useQueryView, type QueryViewSource } from "./useQueryView";

const idle: QueryViewSource<unknown> = {
  data: undefined,
  error: null,
  isLoading: false,
  fetchStatus: "idle",
};

function view<TData>(
  query: QueryViewSource<TData>,
  options: Parameters<typeof useQueryView<TData>>[1] = {},
) {
  return renderHook(() => useQueryView(query, options)).result.current;
}

describe("useQueryView", () => {
  it("reports a first fetch as loading", () => {
    const result = view({ ...idle, isLoading: true, fetchStatus: "fetching" });
    expect(result.state).toBe("loading");
  });

  it("treats a paused query with no data as an offline empty state", () => {
    useConnectionStore.setState({ network: "offline" });
    const result = view({ ...idle, data: undefined, fetchStatus: "paused" });
    expect(result.state).toBe("offline-empty");
    expect(result.isLoading).toBe(false);
  });

  it("keeps cached data ready while the query is paused", () => {
    useConnectionStore.setState({ network: "offline" });
    const result = view({ ...idle, data: [{ id: "v1" }], fetchStatus: "paused" });
    expect(result.state).toBe("ready");
  });

  it("reports a failed query with no data as an error", () => {
    const result = view({ ...idle, error: new Error("down") });
    expect(result.state).toBe("error");
    expect(result.error).toBeInstanceOf(Error);
  });

  it("treats an offline failure with no cache as a neutral offline state", () => {
    useConnectionStore.setState({ network: "offline" });
    const result = view({ ...idle, error: new Error("down") }, { offline: true });
    expect(result.state).toBe("offline-empty");
  });

  it("reports empty when the collection has no rows", () => {
    const result = view({ ...idle, data: [] });
    expect(result.state).toBe("empty");
  });

  it("reports ready when data is present", () => {
    const result = view({ ...idle, data: { id: "v1" } });
    expect(result.state).toBe("ready");
  });

  it("uses a caller-supplied empty predicate for non-collection data", () => {
    const result = view(
      { ...idle, data: { id: "v1", name: "" } },
      { isEmpty: (data) => data.name === "" },
    );
    expect(result.state).toBe("empty");
  });
});
