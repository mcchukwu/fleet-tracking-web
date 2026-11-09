import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { DEFAULT_RESOLUTION, type ResolutionSetting } from "../lib/constants";
import {
  activePreset,
  defaultRange,
  validateRange,
  type PlaybackRange,
  type RangeValidation,
} from "../lib/range";
import type { RangePresetId } from "../lib/constants";

export interface PlaybackUrlState {
  vehicleId: string | null;
  from: string | undefined;
  to: string | undefined;
  resolution: ResolutionSetting;
  range: RangeValidation;
  preset: RangePresetId | null;
  setVehicle: (id: string) => void;
  setRange: (from: string, to: string) => void;
  setResolution: (resolution: ResolutionSetting) => void;
  useDefaultRange: () => void;
}

export function usePlaybackUrl(): PlaybackUrlState {
  const search = useSearch({ from: "/_app/playback" });
  const navigate = useNavigate();

  const vehicleId = search.vehicle ?? null;
  const from = search.from;
  const to = search.to;
  const resolution = search.resolution ?? DEFAULT_RESOLUTION;
  const range = validateRange(from, to);
  const preset = from && to ? activePreset(from, to) : null;

  const missingRange = !from || !to;
  const missingResolution = !search.resolution;

  useEffect(() => {
    if (!missingRange && !missingResolution) return;
    const next: Partial<PlaybackRange> = missingRange ? defaultRange() : {};
    void navigate({
      to: "/playback",
      search: (previous) => ({
        ...previous,
        ...(missingRange ? { from: next.from, to: next.to } : {}),
        ...(missingResolution ? { resolution: DEFAULT_RESOLUTION } : {}),
      }),
      replace: true,
    });
  }, [missingRange, missingResolution, navigate]);

  function setVehicle(id: string): void {
    void navigate({
      to: "/playback",
      search: (previous) => ({ ...previous, vehicle: id }),
      replace: true,
    });
  }

  function setRange(nextFrom: string, nextTo: string): void {
    void navigate({
      to: "/playback",
      search: (previous) => ({ ...previous, from: nextFrom, to: nextTo }),
      replace: true,
    });
  }

  function setResolution(next: ResolutionSetting): void {
    void navigate({
      to: "/playback",
      search: (previous) => ({ ...previous, resolution: next }),
      replace: true,
    });
  }

  function useDefaultRange(): void {
    const next = defaultRange();
    setRange(next.from, next.to);
  }

  return {
    vehicleId,
    from,
    to,
    resolution,
    range,
    preset,
    setVehicle,
    setRange,
    setResolution,
    useDefaultRange,
  };
}
