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

export const auditResponseFixture = {
  data: [
    {
      id: 50,
      action: "auth.login",
      entity: "user",
      entity_id: "00000000-0000-0000-0000-000000000101",
      user_name: "Demo Admin",
      metadata: {},
      created_at: "2026-11-03T08:13:02Z",
    },
    {
      id: 49,
      action: "auth.login",
      entity: "user",
      entity_id: "00000000-0000-0000-0000-000000000102",
      user_name: "Demo Dispatcher",
      metadata: {},
      created_at: "2026-11-03T07:19:10Z",
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

export const reportSummaryBadRowFixture = {
  ...reportSummaryZeroFixture,
  alerts: 3,
  open_alerts: 0,
  alerts_by_type: [
    { key: "speeding", count: 3 },
    { key: null, count: "many" },
  ],
};
