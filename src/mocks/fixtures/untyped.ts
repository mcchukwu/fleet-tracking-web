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

export const importResultFixture = {
  job_id: "job-2026-11-03-001",
  total: 12,
  imported: 11,
  failed: 1,
  errors: [{ row: 7, message: "IMEI already exists" }],
};

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
