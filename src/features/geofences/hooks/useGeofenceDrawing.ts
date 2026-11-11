import { useCallback, useEffect, useRef, useState } from "react";
import type { GeofenceKind, Polygon } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import type { LngLat, MapAdapter } from "../../../map/types";
import { geometryEquals, toPolygon } from "../lib/geometry";

export type GeofenceDrawStatus = "idle" | "preparing" | "ready" | "error";

export interface GeofenceDrawingController {
  status: GeofenceDrawStatus;
  /** Latest committed geometry, refreshed at most once per animation frame. */
  geometry: Polygon | null;
  dirty: boolean;
  error: AppError | null;
  /** Always current, so a save never reads a frame behind the pointer. */
  getGeometry: () => Polygon | null;
  retry: () => void;
  stop: () => void;
  cancel: () => void;
}

export interface GeofenceDrawingOptions {
  adapter: MapAdapter | null;
  active: boolean;
  kind: GeofenceKind;
  initialRing?: readonly LngLat[] | null;
}

function ringKey(ring: readonly LngLat[] | null | undefined): string {
  return ring ? JSON.stringify(ring) : "";
}

/**
 * Owns one draw session. Pointer moves update a ref immediately; React state
 * follows at most once per frame so the list and editor never re-render per move.
 */
export function useGeofenceDrawing({
  adapter,
  active,
  kind,
  initialRing = null,
}: GeofenceDrawingOptions): GeofenceDrawingController {
  const [status, setStatus] = useState<GeofenceDrawStatus>("idle");
  const [geometry, setGeometry] = useState<Polygon | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const geometryRef = useRef<Polygon | null>(null);
  const frameRef = useRef<number | null>(null);
  const initialRingRef = useRef<readonly LngLat[] | null>(initialRing);
  initialRingRef.current = initialRing;
  const initialKey = ringKey(initialRing);

  useEffect(() => {
    if (!active || !adapter) {
      setStatus("idle");
      return;
    }
    const draw = adapter.draw;
    if (!draw) {
      setStatus("error");
      setError(normalize(new Error("Drawing isn't available on this map"), {
        action: "start drawing",
        resource: "the drawing tool",
      }));
      return;
    }

    const baseline = initialRingRef.current ? toPolygon([...initialRingRef.current]) : null;
    let cancelled = false;
    setStatus("preparing");
    setError(null);

    const publish = (next: Polygon | null): void => {
      geometryRef.current = next;
      setDirty(next !== null && (baseline === null || !geometryEquals(next, baseline)));
    };

    const offChange = draw.onChange((next) => {
      geometryRef.current = next;
      if (typeof requestAnimationFrame !== "function") {
        setGeometry(next);
        publish(next);
        return;
      }
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const latest = geometryRef.current;
        setGeometry(latest);
        publish(latest);
      });
    });

    const initial = initialRingRef.current ? [...initialRingRef.current] : undefined;
    void draw
      .start(kind, initial)
      .then(() => {
        if (cancelled) return;
        setStatus("ready");
        setGeometry(draw.getGeometry());
        publish(draw.getGeometry());
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(normalize(cause, { action: "start drawing", resource: "the drawing tool" }));
      });

    return () => {
      cancelled = true;
      offChange();
      if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      draw.cancel();
      geometryRef.current = null;
      setGeometry(null);
      setDirty(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the initial ring is keyed by value.
  }, [active, adapter, kind, initialKey, attempt]);

  const stop = useCallback(() => {
    adapter?.draw?.stop();
    setStatus("idle");
  }, [adapter]);

  const cancel = useCallback(() => {
    adapter?.draw?.cancel();
    geometryRef.current = null;
    setGeometry(null);
    setDirty(false);
    setStatus("idle");
  }, [adapter]);

  return {
    status,
    geometry,
    dirty,
    error,
    getGeometry: () => geometryRef.current,
    retry: () => setAttempt((value) => value + 1),
    stop,
    cancel,
  };
}
