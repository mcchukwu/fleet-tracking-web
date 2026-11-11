import { describe, expect, it } from "vitest";
import type { SystemHealth } from "../../../api/schemas";
import { systemHealthFixture } from "../../../mocks/fixtures/untyped";
import {
  buildHealthGroups,
  counterDelta,
  counterRate,
  counterTrend,
  dependencyLabel,
  healthSummary,
  sortHealthItems,
  summaryLabel,
  updatedLabel,
  type HealthItem,
  type HealthTrend,
} from "./health";

const now = Date.parse("2026-11-12T12:00:00Z");

function data(overrides: Partial<SystemHealth> = {}): SystemHealth {
  return { ...systemHealthFixture, ...overrides };
}

function withIngest(
  overrides: Partial<SystemHealth["ingest"]>,
): SystemHealth {
  return data({ ingest: { ...systemHealthFixture.ingest, ...overrides } });
}

function emptyTrend(): HealthTrend {
  return { first: null, previous: null, reset: false };
}

function trend(
  first: SystemHealth | null,
  previous: SystemHealth | null,
  reset = false,
): HealthTrend {
  return {
    first: first ? { data: first, at: now - 20_000 } : null,
    previous: previous ? { data: previous, at: now - 10_000 } : null,
    reset,
  };
}

function item(groups: ReturnType<typeof buildHealthGroups>, id: string): HealthItem {
  const found = groups.flatMap((group) => group.items).find((entry) => entry.id === id);
  if (!found) throw new Error(`No health item ${id}`);
  return found;
}

describe("dependency labels", () => {
  it("humanises known and unknown keys", () => {
    expect(dependencyLabel("postgres")).toBe("Postgres");
    expect(dependencyLabel("postgres_replica")).toBe("Postgres replica");
    expect(dependencyLabel("cold-path")).toBe("Cold path");
  });

  it("falls back for an empty key", () => {
    expect(dependencyLabel("")).toBe("Dependency");
  });
});

describe("counter maths", () => {
  it("derives a non-negative delta from the first sample", () => {
    expect(counterDelta(120, 100)).toBe(20);
    expect(counterDelta(100, 100)).toBe(0);
    expect(counterDelta(80, 100)).toBe(0);
    expect(counterDelta(120, null)).toBeNull();
  });

  it("derives a per-second rate from consecutive samples", () => {
    expect(counterRate(120, 100, 10_000)).toBe(2);
    expect(counterRate(100, 120, 10_000)).toBe(0);
    expect(counterRate(120, 100, 0)).toBeNull();
    expect(counterRate(120, null, 10_000)).toBeNull();
  });

  it("reports the queue trend", () => {
    expect(counterTrend(5, 4)).toBe("rising");
    expect(counterTrend(4, 4)).toBe("steady");
    expect(counterTrend(3, 4)).toBe("falling");
    expect(counterTrend(3, null)).toBe("unknown");
  });
});

describe("health groups", () => {
  it("shows a dependency as up or down and sorts a problem first", () => {
    const groups = buildHealthGroups(
      data({ dependencies: { postgres: true, redis: false } }),
      now,
      emptyTrend(),
      now,
    );
    const dependencies = groups[0];
    expect(dependencies?.items[0]).toMatchObject({
      label: "Redis",
      value: "Down",
      tone: "critical",
    });
    expect(dependencies?.items[1]).toMatchObject({ label: "Postgres", value: "Up" });
  });

  it("humanises an unknown dependency key without crashing", () => {
    const groups = buildHealthGroups(
      data({ dependencies: { postgres: true, postgres_replica: true } }),
      now,
      emptyTrend(),
      now,
    );
    expect(item(groups, "dependency-postgres_replica").label).toBe(
      "Postgres replica",
    );
  });

  it("shows online as a count of the fleet with a percentage hint", () => {
    const groups = buildHealthGroups(
      data({ online: 20, vehicles: 25 }),
      now,
      emptyTrend(),
      now,
    );
    expect(item(groups, "online")).toMatchObject({
      value: "20 of 25",
      hint: "80% of vehicles",
      tone: "healthy",
    });
    expect(item(groups, "active-trips").value).toBe("4");
    expect(item(groups, "open-alerts").value).toBe("45");
  });

  it("bands the last vehicle report with the shared freshness thresholds", () => {
    const fresh = buildHealthGroups(
      data(),
      now - 10_000,
      emptyTrend(),
      now,
    );
    expect(item(fresh, "last-report")).toMatchObject({
      value: "10s",
      tone: "healthy",
    });

    const delayed = buildHealthGroups(
      data(),
      now - 60_000,
      emptyTrend(),
      now,
    );
    expect(item(delayed, "last-report").tone).toBe("warning");

    const stale = buildHealthGroups(
      data(),
      now - 10 * 60_000,
      emptyTrend(),
      now,
    );
    expect(item(stale, "last-report").tone).toBe("critical");

    const unknown = buildHealthGroups(data(), null, emptyTrend(), now);
    expect(item(unknown, "last-report")).toMatchObject({
      value: "—",
      hint: "No vehicle reports",
      tone: "warning",
    });
  });

  it("measures a failure counter from the sample after it opened", () => {
    const first = withIngest({ dropped: 10 });
    const previous = withIngest({ dropped: 10 });
    const current = withIngest({ dropped: 30 });
    const groups = buildHealthGroups(
      current,
      now,
      trend(first, previous),
      now,
    );
    expect(item(groups, "dropped")).toMatchObject({
      value: "30",
      hint: "+20 · 2/s",
      tone: "warning",
    });
  });

  it("does not warn about a historical nonzero failure total", () => {
    const first = withIngest({ coldpath_failed_alerts: 4 });
    const previous = withIngest({ coldpath_failed_alerts: 4 });
    const groups = buildHealthGroups(
      withIngest({ coldpath_failed_alerts: 4 }),
      now,
      trend(first, previous),
      now,
    );
    expect(item(groups, "coldpath-failures")).toMatchObject({
      value: "4",
      hint: "No change · 0/s",
      tone: "healthy",
    });
  });

  it("says measuring until there are two samples", () => {
    const groups = buildHealthGroups(data(), now, emptyTrend(), now);
    expect(item(groups, "received").hint).toBe("Measuring…");
    expect(item(groups, "queue").hint).toBe("of 20,000 · Measuring…");
  });

  it("makes a full or over-full queue critical", () => {
    const groups = buildHealthGroups(
      withIngest({ queue_length: 20_000, queue_capacity: 20_000 }),
      now,
      emptyTrend(),
      now,
    );
    expect(item(groups, "queue")).toMatchObject({
      tone: "critical",
      hint: "of 20,000 · Measuring…",
    });

    const over = buildHealthGroups(
      withIngest({ queue_length: 21_000, queue_capacity: 20_000 }),
      now,
      emptyTrend(),
      now,
    );
    expect(item(over, "queue").tone).toBe("critical");
  });

  it("never divides by a zero capacity", () => {
    const empty = buildHealthGroups(
      withIngest({ queue_length: 0, queue_capacity: 0 }),
      now,
      emptyTrend(),
      now,
    );
    expect(item(empty, "queue")).toMatchObject({
      value: "0",
      hint: "Capacity not reported",
      tone: "healthy",
    });

    const mystery = buildHealthGroups(
      withIngest({ queue_length: 5, queue_capacity: 0 }),
      now,
      emptyTrend(),
      now,
    );
    expect(item(mystery, "queue").tone).toBe("critical");
  });

  it("warns while the queue or cold-path queue rises below capacity", () => {
    const previous = withIngest({ queue_length: 5 });
    const current = withIngest({ queue_length: 10 });
    const groups = buildHealthGroups(current, now, trend(previous, previous), now);

    expect(item(groups, "queue")).toMatchObject({
      tone: "warning",
      hint: "of 20,000 · Rising",
    });

    const coldPrevious = withIngest({ coldpath_queue_alerts: 1 });
    const coldCurrent = withIngest({ coldpath_queue_alerts: 3 });
    const coldGroups = buildHealthGroups(
      coldCurrent,
      now,
      trend(coldPrevious, coldPrevious),
      now,
    );
    expect(item(coldGroups, "coldpath-queue")).toMatchObject({
      value: "3",
      hint: "Rising",
      tone: "warning",
    });
  });

  it("shows a reset instead of a negative delta", () => {
    const first = withIngest({ received: 500, dropped: 20 });
    const previous = withIngest({ received: 500, dropped: 20 });
    const groups = buildHealthGroups(
      withIngest({ received: 50, dropped: 0 }),
      now,
      trend(first, previous, true),
      now,
    );
    expect(item(groups, "received").hint).toBe("Reset");
    expect(item(groups, "dropped").hint).toBe("Reset");
  });

  it("keeps every item in the declared groups", () => {
    const groups = buildHealthGroups(data(), now, emptyTrend(), now);
    expect(groups.map((group) => group.id)).toEqual([
      "dependencies",
      "fleet",
      "ingest",
    ]);
    expect(groups[0]?.items).toHaveLength(2);
    expect(groups[1]?.items).toHaveLength(4);
    expect(groups[2]?.items).toHaveLength(8);
  });
});

describe("health summary", () => {
  it("says all healthy when every tone is healthy", () => {
    const groups = buildHealthGroups(data(), now, emptyTrend(), now);
    const summary = healthSummary(groups);
    expect(summary).toEqual({ tone: "healthy", issues: 0 });
    expect(summaryLabel(summary)).toBe("All systems healthy");
  });

  it("counts one issue and keeps the worst tone", () => {
    const groups = buildHealthGroups(
      data({ dependencies: { postgres: false, redis: true } }),
      now,
      emptyTrend(),
      now,
    );
    const summary = healthSummary(groups);
    expect(summary).toEqual({ tone: "critical", issues: 1 });
    expect(summaryLabel(summary)).toBe("1 issue needs attention");
  });

  it("pluralises several issues", () => {
    const groups = buildHealthGroups(
      data({ dependencies: { postgres: false, redis: false } }),
      now,
      emptyTrend(),
      now,
    );
    const summary = healthSummary(groups);
    expect(summary).toEqual({ tone: "critical", issues: 2 });
    expect(summaryLabel(summary)).toBe("2 issues need attention");
  });

  it("sorts non-healthy items first without reordering equal tones", () => {
    const items: HealthItem[] = [
      { id: "a", label: "A", value: "1", tone: "healthy" },
      { id: "b", label: "B", value: "2", tone: "warning" },
      { id: "c", label: "C", value: "3", tone: "critical" },
      { id: "d", label: "D", value: "4", tone: "warning" },
    ];
    expect(sortHealthItems(items).map((entry) => entry.id)).toEqual([
      "c",
      "b",
      "d",
      "a",
    ]);
  });
});

describe("updated label", () => {
  it("formats the age and the missing case", () => {
    expect(updatedLabel(now - 3_000, now)).toBe("Health updated just now");
    expect(updatedLabel(now - 12_000, now)).toBe("Health updated 12s ago");
    expect(updatedLabel(now - 120_000, now)).toBe("Health updated 2m ago");
    expect(updatedLabel(null, now)).toBe("Health updated —");
  });
});
