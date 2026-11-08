import { describe, expect, it } from "vitest";
import type { Alert } from "../../../api/types";
import { flattenPages, nextFeedView, nextOffsetFor } from "./feed";

function alert(id: string, occurred = "2026-11-02T12:00:00Z"): Alert {
  return {
    id,
    vehicle_id: "v-1",
    plate: "LSD-101-AA",
    type: "idle",
    severity: "high",
    status: "open",
    occurred_at: occurred,
    evidence: {},
  };
}

describe("alert feed", () => {
  it("flattens pages, dedupes by id and sorts newest first", () => {
    const flat = flattenPages([
      [alert("a", "2026-11-02T12:00:00Z"), alert("b", "2026-11-02T10:00:00Z")],
      [alert("b", "2026-11-02T10:00:00Z"), alert("c", "2026-11-02T11:00:00Z")],
    ]);
    expect(flat.map((row) => row.id)).toEqual(["a", "c", "b"]);
  });

  it("asks for another page only when the last page is full", () => {
    expect(nextOffsetFor(1, 500, 500)).toBe(500);
    expect(nextOffsetFor(2, 10, 500)).toBeNull();
  });

  it("renders new head rows immediately when the list is at the top", () => {
    const previous = [alert("a"), alert("b")];
    const incoming = [alert("c", "2026-11-02T13:00:00Z"), ...previous];
    const view = nextFeedView({
      previousVisible: previous,
      previousPendingIds: new Set(),
      incoming,
      atTop: true,
      reset: false,
    });
    expect(view.visible.map((row) => row.id)).toEqual(["c", "a", "b"]);
    expect(view.newCount).toBe(0);
    expect([...view.highlightIds]).toEqual(["c"]);
  });

  it("freezes visible rows and counts pending rows while scrolled", () => {
    const previous = [alert("a"), alert("b")];
    const incoming = [alert("c", "2026-11-02T13:00:00Z"), ...previous];
    const view = nextFeedView({
      previousVisible: previous,
      previousPendingIds: new Set(),
      incoming,
      atTop: false,
      reset: false,
    });
    expect(view.visible.map((row) => row.id)).toEqual(["a", "b"]);
    expect(view.pending.map((row) => row.id)).toEqual(["c"]);
    expect(view.newCount).toBe(1);
    expect(view.highlightIds.size).toBe(0);
  });

  it("reveals pending rows and highlights them", () => {
    const previous = [alert("a"), alert("b")];
    const pending = [alert("c", "2026-11-02T13:00:00Z")];
    const incoming = [...pending, ...previous];
    const view = nextFeedView({
      previousVisible: previous,
      previousPendingIds: new Set(["c"]),
      incoming,
      atTop: true,
      reset: false,
    });
    expect(view.visible.map((row) => row.id)).toEqual(["c", "a", "b"]);
    expect(view.newCount).toBe(0);
    expect([...view.highlightIds]).toEqual(["c"]);
  });

  it("removes an acknowledged row from a frozen list", () => {
    const previous = [alert("a"), alert("b")];
    const view = nextFeedView({
      previousVisible: previous,
      previousPendingIds: new Set(),
      incoming: [alert("b")],
      atTop: false,
      reset: false,
    });
    expect(view.visible.map((row) => row.id)).toEqual(["b"]);
  });

  it("resets the freeze on a filter change without highlighting", () => {
    const incoming = [alert("a"), alert("b")];
    const view = nextFeedView({
      previousVisible: [alert("old")],
      previousPendingIds: new Set(["old"]),
      incoming,
      atTop: false,
      reset: true,
    });
    expect(view.visible.map((row) => row.id)).toEqual(["a", "b"]);
    expect(view.newCount).toBe(0);
    expect(view.highlightIds.size).toBe(0);
  });
});
