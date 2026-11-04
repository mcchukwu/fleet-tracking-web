import { create } from "zustand";
import type { PositionMessage } from "../api/schemas";
import type { SnapshotVehicle } from "../api/types";

export interface LivePosition {
  key: string;
  lat: number;
  lon: number;
  positionAt: number;
  recordedAt: string;
  speedKph: number | null;
  headingDeg: number | null;
  speedAt: number | null;
  alertMarkedAt: number | null;
}

export interface LiveState {
  positions: Record<string, LivePosition>;
  knownKeys: ReadonlySet<string>;
  version: number;
  frameCount: number;
  batchCount: number;
  unknownKeys: number;
  newestPositionAt: number | null;
  applySnapshot: (vehicles: readonly SnapshotVehicle[], now?: number) => void;
  applyFrames: (frames: readonly PositionMessage[], now?: number) => number | null;
  markAlert: (key: string, at?: number) => void;
  reset: () => void;
}

function positionOf(vehicle: SnapshotVehicle): Omit<LivePosition, "speedKph" | "headingDeg" | "speedAt" | "alertMarkedAt"> | null {
  if (
    typeof vehicle.lat !== "number" ||
    typeof vehicle.lon !== "number" ||
    typeof vehicle.recorded_at !== "string"
  ) {
    return null;
  }
  const at = Date.parse(vehicle.recorded_at);
  if (Number.isNaN(at)) return null;
  return {
    key: vehicle.external_id,
    lat: vehicle.lat,
    lon: vehicle.lon,
    positionAt: at,
    recordedAt: vehicle.recorded_at,
  };
}

const initial = {
  positions: {} as Record<string, LivePosition>,
  knownKeys: new Set<string>() as ReadonlySet<string>,
  version: 0,
  frameCount: 0,
  batchCount: 0,
  unknownKeys: 0,
  newestPositionAt: null as number | null,
};

export const useLiveStore = create<LiveState>((set, get) => ({
  ...initial,

  applySnapshot: (vehicles, _now = Date.now()) => {
    const positions = { ...get().positions };
    const knownKeys = new Set(vehicles.map((vehicle) => vehicle.external_id));

    for (const vehicle of vehicles) {
      const seeded = positionOf(vehicle);
      if (!seeded) continue;

      const existing = positions[seeded.key];
      const hasSpeed = typeof vehicle.speed_kph === "number" || typeof vehicle.heading_deg === "number";

      if (!existing) {
        positions[seeded.key] = {
          ...seeded,
          speedKph: vehicle.speed_kph ?? null,
          headingDeg: vehicle.heading_deg ?? null,
          speedAt: hasSpeed ? seeded.positionAt : null,
          alertMarkedAt: null,
        };
        continue;
      }

      const positionIsNewer = seeded.positionAt > existing.positionAt;
      const speedIsNewer = hasSpeed && (existing.speedAt === null || seeded.positionAt >= existing.speedAt);

      positions[seeded.key] = {
        ...existing,
        ...(positionIsNewer
          ? {
              lat: seeded.lat,
              lon: seeded.lon,
              positionAt: seeded.positionAt,
              recordedAt: seeded.recordedAt,
            }
          : {}),
        ...(speedIsNewer
          ? {
              speedKph: vehicle.speed_kph ?? existing.speedKph,
              headingDeg: vehicle.heading_deg ?? existing.headingDeg,
              speedAt: seeded.positionAt,
            }
          : {}),
      };
    }

    set((state) => ({
      positions,
      knownKeys,
      version: state.version + 1,
    }));
  },

  applyFrames: (frames, _now = Date.now()) => {
    const state = get();
    const positions = { ...state.positions };
    let unknown = 0;
    let newest: number | null = null;

    for (const frame of frames) {
      const key = frame.vehicle_id;
      if (!state.knownKeys.has(key)) {
        unknown += 1;
        continue;
      }

      const at = Date.parse(frame.recorded_at);
      if (Number.isNaN(at)) continue;

      const existing = positions[key];
      if (existing && at <= existing.positionAt) continue;

      positions[key] = {
        key,
        lat: frame.lat,
        lon: frame.lon,
        positionAt: at,
        recordedAt: frame.recorded_at,
        speedKph: existing?.speedKph ?? null,
        headingDeg: existing?.headingDeg ?? null,
        speedAt: existing?.speedAt ?? null,
        alertMarkedAt: existing?.alertMarkedAt ?? null,
      };
      if (newest === null || at > newest) newest = at;
    }

    set((current) => ({
      positions,
      version: current.version + 1,
      frameCount: current.frameCount + frames.length,
      batchCount: current.batchCount + 1,
      unknownKeys: current.unknownKeys + unknown,
      newestPositionAt: newest ?? current.newestPositionAt,
    }));

    return newest;
  },

  markAlert: (key, at = Date.now()) => {
    const existing = get().positions[key];
    if (!existing) return;
    set((state) => ({
      positions: {
        ...state.positions,
        [key]: { ...existing, alertMarkedAt: at },
      },
      version: state.version + 1,
    }));
  },

  reset: () => {
    set({ ...initial, positions: {}, knownKeys: new Set<string>() });
  },
}));
