import { useCallback, useEffect, useRef } from "react";
import type { MapAdapter, Padding } from "../../../map/types";
import { routeBounds } from "../../../map/route";
import type { LngLat } from "../../../map/types";

export interface PlaybackCameraOptions {
  adapter: MapAdapter | null;
  points: readonly LngLat[];
  fitKey: string;
  topInset: number;
  bottomInset: number;
  reducedMotion: boolean;
}

export interface PlaybackCameraController {
  fit: () => void;
}

export function usePlaybackCamera({
  adapter,
  points,
  fitKey,
  topInset,
  bottomInset,
  reducedMotion,
}: PlaybackCameraOptions): PlaybackCameraController {
  const pointsRef = useRef(points);
  const insetsRef = useRef({ topInset, bottomInset });
  const reducedRef = useRef(reducedMotion);

  useEffect(() => {
    pointsRef.current = points;
    insetsRef.current = { topInset, bottomInset };
    reducedRef.current = reducedMotion;
  }, [points, topInset, bottomInset, reducedMotion]);

  const fit = useCallback(() => {
    if (!adapter) return;
    const current = pointsRef.current;
    const first = current[0];
    if (!first) return;
    const padding: Padding = {
      top: insetsRef.current.topInset + 12,
      right: 12,
      bottom: insetsRef.current.bottomInset + 12,
      left: 12,
    };
    if (current.length === 1) {
      adapter.flyTo(first, 14, { padding });
      return;
    }
    const bounds = routeBounds(current);
    if (bounds) adapter.fitBounds(bounds, { padding, animate: !reducedRef.current });
  }, [adapter]);

  useEffect(() => {
    fit();
  }, [adapter, fitKey, fit, topInset, bottomInset]);

  return { fit };
}
