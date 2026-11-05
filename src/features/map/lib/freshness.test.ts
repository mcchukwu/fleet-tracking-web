import { describe, expect, it } from "vitest";
import { mapFreshness } from "./freshness";

const base = {
  offline: false,
  socket: "live" as const,
  socketDownAt: null,
  lastDataAt: 1_000,
  now: 2_000,
  staleAfterMs: 300_000,
  socketGraceMs: 10_000,
};

describe("mapFreshness", () => {
  it("is fresh while frames keep arriving", () => {
    expect(mapFreshness(base)).toEqual({ ageSeconds: 1, stale: false, reason: null });
  });

  it("marks a live socket stale once the stream goes silent", () => {
    expect(mapFreshness({ ...base, now: 12_000 })).toMatchObject({
      stale: true,
      reason: "silent",
    });
  });

  it("marks a dropped socket stale only after the grace period", () => {
    expect(
      mapFreshness({ ...base, socket: "reconnecting", socketDownAt: 1_000, now: 5_000 }),
    ).toMatchObject({ stale: false, reason: null });
    expect(
      mapFreshness({ ...base, socket: "reconnecting", socketDownAt: 1_000, now: 20_000 }),
    ).toMatchObject({ stale: true, reason: "socket" });
  });

  it("marks old data stale when there is no stream to judge", () => {
    expect(
      mapFreshness({ ...base, socket: "reconnecting", socketDownAt: null, now: 400_000 }),
    ).toMatchObject({
      stale: true,
      reason: "age",
    });
  });

  it("treats offline as stale regardless of timestamps", () => {
    expect(mapFreshness({ ...base, offline: true, lastDataAt: null })).toEqual({
      ageSeconds: null,
      stale: true,
      reason: "offline",
    });
  });
});
