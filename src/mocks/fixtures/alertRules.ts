import type { AlertRule } from "../../api/types";

export const alertRulesFixture: AlertRule[] = [
  {
    id: "f8509d74-48bc-4331-82cf-926505b61775",
    type: "geofence_exit",
    enabled: true,
    config: {},
  },
  {
    id: "1fad1279-ae57-4f16-9bfd-9d5b0a8cabb5",
    type: "route_deviation",
    enabled: true,
    config: {
      distance_m: 2000,
      duration_s: 180,
    },
  },
  {
    id: "efa845e1-0484-447d-bb01-611e7472706a",
    type: "idle",
    enabled: true,
    config: {
      speed_kph: 2,
      duration_s: 600,
    },
  },
  {
    id: "c8f53fb1-7479-4d1d-87f5-fce3cfce8c02",
    type: "speeding",
    enabled: true,
    config: {
      speed_kph: 80,
      duration_s: 120,
    },
  },
  {
    id: "470ce9ba-394f-4528-a5a5-94f478fbfeef",
    type: "device_offline",
    enabled: true,
    config: {
      duration_s: 600,
    },
  },
  {
    id: "b0f24a47-73ee-4e8e-b062-10e3573aae48",
    type: "unplanned_trip",
    enabled: true,
    config: {},
  },
  {
    id: "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f87",
    type: "solar_flare",
    enabled: true,
    config: {
      threshold: 5,
    },
  },
];
