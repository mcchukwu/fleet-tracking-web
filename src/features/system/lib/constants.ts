export const SYSTEM_HEALTH_POLL_MS = 10_000;

export const HEALTH_GROUP_IDS = ["dependencies", "fleet", "ingest"] as const;
export type HealthGroupId = (typeof HEALTH_GROUP_IDS)[number];

export const DEPENDENCY_GROUP_ID: HealthGroupId = "dependencies";
export const FLEET_GROUP_ID: HealthGroupId = "fleet";
export const INGEST_GROUP_ID: HealthGroupId = "ingest";
