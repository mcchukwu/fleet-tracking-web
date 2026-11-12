export const SYSTEM_HEALTH_POLL_MS = 10_000;

export const HEALTH_GROUP_IDS = ["dependencies", "fleet", "ingest"] as const;
export type HealthGroupId = (typeof HEALTH_GROUP_IDS)[number];

export interface HealthGroupSpec {
  id: HealthGroupId;
  title: string;
  description: string;
  columns: 2 | 4;
}

export const HEALTH_GROUP_COLUMNS = {
  2: "sm:grid-cols-2",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

/** Shared by the ready groups and the loading skeleton so both keep one shape. */
export const HEALTH_GROUP_SPECS: readonly HealthGroupSpec[] = [
  {
    id: "dependencies",
    title: "Dependencies",
    description: "Services the API depends on.",
    columns: 2,
  },
  {
    id: "fleet",
    title: "Fleet",
    description: "Fleet counts and the newest position report.",
    columns: 4,
  },
  {
    id: "ingest",
    title: "Ingest",
    description:
      "Cumulative counters. Rates and changes are measured from consecutive polls since this page opened.",
    columns: 4,
  },
];
