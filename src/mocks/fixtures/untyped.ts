export const systemHealthFixture = {
  active_trips: 4,
  dependencies: { postgres: true, redis: true },
  ingest: {
    coldpath_failed_alerts: 4,
    coldpath_failed_positions: 0,
    coldpath_queue_alerts: 0,
    coldpath_queue_positions: 0,
    dropped: 0,
    queue_capacity: 20000,
    queue_length: 0,
    received: 72180,
    redis_errors: 0,
    stale: 0,
    validation_errors: 0,
  },
  online: 20,
  open_alerts: 45,
  vehicles: 25,
};

// Mock-only scenarios for the system health screen; shapes match the staging probe.
export const systemHealthDependencyDownFixture = {
  ...systemHealthFixture,
  dependencies: { postgres: true, redis: false },
};

export const systemHealthQueueFullFixture = {
  ...systemHealthFixture,
  ingest: {
    ...systemHealthFixture.ingest,
    queue_length: systemHealthFixture.ingest.queue_capacity,
  },
};

/** Rising counters: `step` is the zero-based request number for this page. */
export function systemHealthRisingFixture(step: number) {
  const n = Math.max(0, step);
  return {
    ...systemHealthFixture,
    ingest: {
      ...systemHealthFixture.ingest,
      coldpath_queue_positions: n,
      dropped: n * 3,
      queue_length: n * 5,
      received: systemHealthFixture.ingest.received + n * 100,
      redis_errors: n,
    },
  };
}

// Captured shapes from staging on 2026-11-12: seven fields, newest first.
export const auditResponseFixture = {
  data: [
    {
      id: 207,
      action: "auth.login",
      entity: "user",
      entity_id: "00000000-0000-0000-0000-000000000101",
      user_name: "Demo Admin",
      metadata: {},
      created_at: "2026-11-12T02:03:55Z",
    },
    {
      id: 206,
      action: "import.vehicles",
      entity: "import_job",
      entity_id: "00000000-0000-0000-0000-000000000401",
      user_name: "Demo Dispatcher",
      metadata: { imported: 12, failed: 2 },
      created_at: "2026-11-12T01:48:20Z",
    },
    {
      id: 205,
      action: "trip.create",
      entity: "trip",
      entity_id: "00000000-0000-0000-0000-000000000501",
      user_name: "Demo Dispatcher",
      metadata: { vehicle_id: "00000000-0000-0000-0000-000000000301" },
      created_at: "2026-11-12T01:31:04Z",
    },
    {
      id: 204,
      action: "trip.update",
      entity: "trip",
      entity_id: "00000000-0000-0000-0000-000000000501",
      user_name: "Demo Dispatcher",
      metadata: { status: "active" },
      created_at: "2026-11-12T01:29:11Z",
    },
    {
      id: 203,
      action: "alert.ack",
      entity: "alert",
      entity_id: "00000000-0000-0000-0000-000000000601",
      user_name: "Demo Security",
      metadata: {},
      created_at: "2026-11-12T00:55:47Z",
    },
    {
      id: 202,
      action: "geofence.create",
      entity: "geofence",
      entity_id: "00000000-0000-0000-0000-000000000201",
      user_name: "Demo Admin",
      metadata: {},
      created_at: "2026-11-11T23:40:33Z",
    },
    {
      id: 201,
      action: "geofence.update",
      entity: "geofence",
      entity_id: "00000000-0000-0000-0000-000000000202",
      user_name: "Demo Admin",
      metadata: {},
      created_at: "2026-11-11T22:12:09Z",
    },
    {
      id: 200,
      action: "geofence.delete",
      entity: "geofence",
      entity_id: "00000000-0000-0000-0000-000000000203",
      user_name: "Demo Admin",
      metadata: {},
      created_at: "2026-11-11T21:03:58Z",
    },
    {
      id: 199,
      action: "driver.create",
      entity: "driver",
      entity_id: "00000000-0000-0000-0000-000000000701",
      user_name: "Demo Dispatcher",
      metadata: {},
      created_at: "2026-11-11T19:44:26Z",
    },
    {
      id: 198,
      action: "driver.update",
      entity: "driver",
      entity_id: "00000000-0000-0000-0000-000000000702",
      user_name: "Demo Dispatcher",
      metadata: {},
      created_at: "2026-11-11T18:20:14Z",
    },
    {
      id: 197,
      action: "vehicle.update",
      entity: "vehicle",
      entity_id: "00000000-0000-0000-0000-000000000301",
      user_name: "Demo Dispatcher",
      metadata: { depot: "Apapa Depot" },
      created_at: "2026-11-11T17:05:42Z",
    },
    {
      id: 196,
      action: "trip.complete",
      entity: "trip",
      entity_id: "00000000-0000-0000-0000-000000000502",
      user_name: "Demo Dispatcher",
      metadata: {},
      created_at: "2026-11-11T16:30:10Z",
    },
  ],
};

const auditActions = [
  "auth.login",
  "alert.ack",
  "driver.create",
  "driver.update",
  "geofence.create",
  "geofence.update",
  "geofence.delete",
  "import.vehicles",
  "trip.create",
  "trip.update",
  "trip.complete",
  "vehicle.update",
] as const;

const auditEntityByAction: Record<(typeof auditActions)[number], string> = {
  "auth.login": "user",
  "alert.ack": "alert",
  "driver.create": "driver",
  "driver.update": "driver",
  "geofence.create": "geofence",
  "geofence.update": "geofence",
  "geofence.delete": "geofence",
  "import.vehicles": "import_job",
  "trip.create": "trip",
  "trip.update": "trip",
  "trip.complete": "trip",
  "vehicle.update": "vehicle",
};

/** Deterministic 205-entry log for the paging test. */
export const auditLargeFixture = {
  data: Array.from({ length: 205 }, (_, index) => {
    const action = auditActions[index % auditActions.length] ?? "auth.login";
    return {
      id: 1_205 - index,
      action,
      entity: auditEntityByAction[action],
      entity_id: `00000000-0000-0000-0000-${String(1_000 + index).padStart(12, "0")}`,
      user_name: index % 3 === 0 ? "Demo Security" : "Demo Admin",
      metadata: action === "import.vehicles" ? { imported: index % 9, failed: 1 } : {},
      created_at: new Date(Date.UTC(2026, 10, 12, 2, 0, 0) - index * 300_000).toISOString(),
    };
  }),
};

/** New backend actions must render humanised, never disappear or crash. */
export const auditUnknownFixture = {
  data: [
    {
      id: 900,
      action: "user.role_change",
      entity: "maintenance_job",
      entity_id: "00000000-0000-0000-0000-000000000901",
      user_name: "Demo Admin",
      metadata: {
        from: "viewer",
        to: "admin",
        nested: { reason: "promotion" },
      },
      created_at: "2026-11-12T03:00:00Z",
    },
  ],
};

// Captured against staging on 2026-11-11 with dispatcher@demo.ftb.
export const importCleanFixture = {
  job_id: "job-2026-11-11-clean",
  total: 2,
  imported: 2,
  failed: 0,
  errors: null,
};

export const importPartialFixture = {
  job_id: "job-2026-11-11-partial",
  total: 12,
  imported: 11,
  failed: 1,
  errors: [{ row: 7, message: "IMEI already exists" }],
};

export const importCappedFixture = {
  job_id: "job-2026-11-11-capped",
  total: 110,
  imported: 5,
  failed: 105,
  errors: Array.from({ length: 100 }, (_, index) => ({
    row: index + 2,
    message: `Row ${index + 2} has an invalid year`,
  })),
};

export const invalidCsvErrorFixture = {
  error: { code: "invalid_csv", message: "the header must include imei" },
};

export const importResultFixture = importPartialFixture;

export const reportSummaryFixture = {
  active_trips: 4,
  alerts: 66,
  alerts_by_type: [
    { key: "geofence_exit", count: 31 },
    { key: "geofence_enter", count: 28 },
    { key: "route_deviation", count: 7 },
  ],
  completed_trips: 1,
  distance_km: 10917.07,
  from: "2026-10-27T08:13:42.114639496Z",
  open_alerts: 45,
  to: "2026-11-03T08:13:42.114639496Z",
  trips: 5,
  vehicles: 25,
};

// Mock-only scenarios for the reports screen; shapes match the staging probe.
export const reportSummaryZeroFixture = {
  active_trips: 0,
  alerts: 0,
  alerts_by_type: [],
  completed_trips: 0,
  distance_km: 0,
  from: "2026-10-27T08:13:42.114639496Z",
  open_alerts: 0,
  to: "2026-11-03T08:13:42.114639496Z",
  trips: 0,
  vehicles: 25,
};

export const reportSummaryLargeFixture = {
  active_trips: 128,
  alerts: 45_231,
  alerts_by_type: [
    { key: "solar_flare", count: 120 },
    { key: "speeding", count: 30_120 },
    { key: "geofence_exit", count: 9_800 },
    { key: "idle", count: 0 },
  ],
  completed_trips: 12_045,
  distance_km: 1_284_932.5,
  from: "2026-10-27T08:13:42.114639496Z",
  open_alerts: 402,
  to: "2026-11-03T08:13:42.114639496Z",
  trips: 15_430,
  vehicles: 25,
};

export const reportSummaryNoBreakdownFixture = {
  ...reportSummaryZeroFixture,
  alerts: 66,
  open_alerts: 45,
};

/** A seven-digit type count for the chart's fixed value column. */
export const reportSummaryHugeChartFixture = {
  ...reportSummaryLargeFixture,
  alerts: 1_284_945,
  alerts_by_type: [
    { key: "speeding", count: 1_284_933 },
    { key: "geofence_exit", count: 12 },
  ],
};

export const reportSummaryBadRowFixture = {
  ...reportSummaryZeroFixture,
  alerts: 3,
  open_alerts: 0,
  alerts_by_type: [
    { key: "speeding", count: 3 },
    { key: null, count: "many" },
  ],
};
