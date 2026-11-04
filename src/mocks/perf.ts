import type { Vehicle } from "../api/types";
import { vehiclesFixture } from "./fixtures/vehicles";

const template = vehiclesFixture[0];

const depots = ["Lekki Depot", "Apapa Depot", "Ikeja Depot"];

/** Deterministic fleet used only by the mock-mode performance switch. */
export function perfVehicles(count = 5_000, now = Date.now()): Vehicle[] {
  if (!template) throw new Error("vehicle fixture is empty");
  return Array.from({ length: count }, (_, index) => {
    const minutes = Math.floor(index / 100);
    return {
      ...template,
      id: `perf-uuid-${index}`,
      external_id: `perf-imei-${index}`,
      plate: `PERF-${String(index).padStart(5, "0")}`,
      driver_name: `Driver ${index % 40}`,
      depot: depots[index % depots.length] ?? "Lekki Depot",
      lat: 4.6 + (minutes % 120) * 0.03,
      lon: 2.8 + Math.floor(index / 12_000) * 0.2 + (index % 100) * 0.01,
      speed_kph: 20 + (index % 60),
      heading_deg: (index * 7) % 360,
      recorded_at: new Date(now - (index % 30) * 1_000).toISOString(),
      online: true,
      trip_status: index % 100 === 0 ? "active" : undefined,
    };
  });
}
