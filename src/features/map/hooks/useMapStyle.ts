import { useCallback, useEffect, useRef, useState } from "react";
import { availableMapStyles } from "../../../map/config";
import type { MapStyleId } from "../../../map/types";
import { guardedStorage } from "../../../lib/storage";
import { useConnection } from "../../../stores/connection";

export const MAP_STYLE_KEY = "fleet.map.style";

export type MapStyleFallbackReason = "offline" | "failed" | "quota";

export interface MapStyleFallback {
  style: MapStyleId;
  reason: MapStyleFallbackReason;
}

function isAvailableStyle(
  value: string | null,
  styles: readonly MapStyleId[],
): value is MapStyleId {
  return value !== null && styles.some((style) => style === value);
}

function readStyle(styles: readonly MapStyleId[]): MapStyleId {
  const stored = guardedStorage.get(MAP_STYLE_KEY);
  return isAvailableStyle(stored, styles) ? stored : "standard";
}

export interface UseMapStyleOptions {
  styles?: readonly MapStyleId[];
}

export interface MapStyleController {
  chosenStyle: MapStyleId;
  effectiveStyle: MapStyleId;
  styles: readonly MapStyleId[];
  offline: boolean;
  fallback: MapStyleFallback | null;
  dismissFallback: () => void;
  chooseStyle: (id: MapStyleId) => void;
  failStyle: (id: MapStyleId, reason: MapStyleFallbackReason) => void;
}

export function useMapStyle(options: UseMapStyleOptions = {}): MapStyleController {
  const styles = options.styles ?? availableMapStyles;
  const { network } = useConnection();
  const offline = network === "offline";
  const [chosenStyle, setChosenStyle] = useState<MapStyleId>(() => readStyle(styles));
  const [fallback, setFallback] = useState<MapStyleFallback | null>(() =>
    offline && chosenStyle !== "standard" ? { style: chosenStyle, reason: "offline" } : null,
  );
  const wasOfflineRef = useRef(offline);

  // The notice is raised on a network transition, not on every render. Keeping
  // the previous value in a ref makes the effect the only writer.
  useEffect(() => {
    if (wasOfflineRef.current === offline) return;
    wasOfflineRef.current = offline;
    // The chosen style stays stored, so it returns when the connection does.
    setFallback(
      offline && chosenStyle !== "standard" ? { style: chosenStyle, reason: "offline" } : null,
    );
  }, [offline, chosenStyle]);

  const effectiveStyle: MapStyleId =
    offline && chosenStyle !== "standard" ? "standard" : chosenStyle;

  const chooseStyle = useCallback(
    (id: MapStyleId) => {
      if (!styles.includes(id)) return;
      if (offline && id !== "standard") return;
      setChosenStyle(id);
      guardedStorage.set(MAP_STYLE_KEY, id);
      setFallback(null);
    },
    [offline, styles],
  );

  const failStyle = useCallback((id: MapStyleId, reason: MapStyleFallbackReason) => {
    setChosenStyle((current) => (current === id ? "standard" : current));
    if (guardedStorage.get(MAP_STYLE_KEY) === id) {
      guardedStorage.set(MAP_STYLE_KEY, "standard");
    }
    setFallback((current) =>
      current && current.style === id && current.reason === reason
        ? current
        : { style: id, reason },
    );
  }, []);

  const dismissFallback = useCallback(() => setFallback(null), []);

  return {
    chosenStyle,
    effectiveStyle,
    styles,
    offline,
    fallback,
    dismissFallback,
    chooseStyle,
    failStyle,
  };
}
