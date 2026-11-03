import type { LiveMessage } from "../api/schemas";
import { alertFrame, olderPositionFrame, positionFrame } from "./fixtures/live";

export const demoLiveScenario: LiveMessage[] = [
  positionFrame,
  olderPositionFrame,
  alertFrame,
  {
    type: "position",
    tenant_id: "tenant-demo",
    vehicle_id: "demo-imei-0001",
    lat: 6.53,
    lon: 3.39,
    recorded_at: "2026-11-03T08:14:00Z",
  },
];
