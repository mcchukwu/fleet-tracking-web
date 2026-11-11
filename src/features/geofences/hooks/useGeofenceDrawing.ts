import { useCallback, useEffect, useRef, useState } from "react";
import type { GeofenceKind, Polygon } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import type { LngLat, MapAdapter } from "../../../map/types";
import { geometryEquals, toPolygon } from "../lib/geometry";

export type GeofenceDrawStatus = "idle" | "preparing" | "ready" | "error" | "interrupted";

export interface GeofenceDrawingController {
  status: GeofenceDrawStatus;
  /** Latest committed geometry, refreshed at most once per animation frame. */
  geometry: Polygon | null;
  dirty: boolean;
  error: AppError | null;
  /** Honest explanation when a session was restarted or cancelled underneath the user. */
  notice: string | null;
  /** True when a replacement map is available to restart the session on. */
  canResume: boolean;
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

const MAP_RELOADED = "The map reloaded. Draw the polygon again.";
const MAP_UNAVAILABLE = "The map isn't available. Reconnect to continue drawing.";
const DRAWING_CANCELLED = "Drawing was cancelled. Draw the polygon again.";

function ringKey(ring: readonly LngLat[] | null | undefined): string {
  return ring ? JSON.stringify(ring) : "";
}

function polygonRing(geometry: Polygon | null): LngLat[] | null {
  const ring = geometry?.coordinates[0];
  return ring ? ring.map(([lon, lat]) => [lon, lat] as LngLat) : null;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const geometryRef = useRef<Polygon | null>(null);
  const lastGeometryRef = useRef<Polygon | null>(null);
  const resumeRingRef = useRef<readonly LngLat[] | null>(null);
  const startedAdapterRef = useRef<MapAdapter | null>(null);
  const statusRef = useRef<GeofenceDrawStatus>("idle");
  const frameRef = useRef<number | null>(null);
  const initialRingRef = useRef<readonly LngLat[] | null>(initialRing);
  initialRingRef.current = initialRing;
  statusRef.current = status;
  const initialKey = ringKey(initialRing);

  useEffect(() => {
    const previousAdapter = startedAdapterRef.current;
    const kept = lastGeometryRef.current;

    if (active && previousAdapter !== null && previousAdapter !== adapter && kept) {
      resumeRingRef.current = polygonRing(kept);
      startedAdapterRef.current = null;
      geometryRef.current = kept;
      setGeometry(kept);
      setDirty(true);
      setStatus("interrupted");
      setError(null);
      setNotice(adapter ? MAP_RELOADED : MAP_UNAVAILABLE);
      return;
    }

    if (!active || !adapter) {
      startedAdapterRef.current = null;
      setStatus("idle");
      return;
    }
    const draw = adapter.draw;
    if (!draw) {
      startedAdapterRef.current = null;
      setStatus("error");
      setError(
        normalize(new Error("Drawing isn't available on this map"), {
          action: "start drawing",
          resource: "the drawing tool",
        }),
      );
      return;
    }

    const baseline = initialRingRef.current ? toPolygon([...initialRingRef.current]) : null;
    let cancelled = false;
    setStatus("preparing");
    setError(null);
    setNotice(null);

    const publish = (next: Polygon | null): void => {
      geometryRef.current = next;
      lastGeometryRef.current = next;
      if (next) setNotice(null);
      setDirty(next !== null && (baseline === null || !geometryEquals(next, baseline)));
    };

    const offChange = draw.onChange((next) => {
      const previous = lastGeometryRef.current;
      geometryRef.current = next;
      lastGeometryRef.current = next;
      if (next === null && previous !== null) setNotice(DRAWING_CANCELLED);
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

    const offStyle = adapter.on("styleChange", () => {
      if (statusRef.current === "ready" && lastGeometryRef.current === null) {
        setNotice(DRAWING_CANCELLED);
      }
    });

    const resume = resumeRingRef.current ?? initialRingRef.current;
    resumeRingRef.current = null;
    const initial = resume ? [...resume] : undefined;
    void draw
      .start(kind, initial)
      .then(() => {
        if (cancelled) return;
        startedAdapterRef.current = adapter;
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
      offStyle();
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
    startedAdapterRef.current = null;
    setNotice(null);
    setStatus("idle");
  }, [adapter]);

  const cancel = useCallback(() => {
    adapter?.draw?.cancel();
    startedAdapterRef.current = null;
    resumeRingRef.current = null;
    geometryRef.current = null;
    lastGeometryRef.current = null;
    setGeometry(null);
    setDirty(false);
    setNotice(null);
    setStatus("idle");
  }, [adapter]);

  const retry = useCallback(() => {
    if (!adapter) return;
    setAttempt((value) => value + 1);
  }, [adapter]);

  return {
    status,
    geometry,
    dirty,
    error,
    notice,
    canResume: adapter !== null,
    getGeometry: () => geometryRef.current,
    retry,
    stop,
    cancel,
  };
}
