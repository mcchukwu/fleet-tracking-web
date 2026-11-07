import { useCallback, useEffect, useRef, useState } from "react";
import { availableMapStyles } from "../../../map/config";
import type { MapStyleId } from "../../../map/types";
import { guardedStorage } from "../../../lib/storage";
import { useConnection } from "../../../stores/connection";

export const MAP_STYLE_KEY = "fleet.map.style";

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
  fallbackNotice: boolean;
  dismissFallbackNotice: () => void;
  chooseStyle: (id: MapStyleId) => void;
}

export function useMapStyle(options: UseMapStyleOptions = {}): MapStyleController {
  const styles = options.styles ?? availableMapStyles;
  const { network } = useConnection();
  const offline = network === "offline";
  const [chosenStyle, setChosenStyle] = useState<MapStyleId>(() => readStyle(styles));
  const [fallbackNotice, setFallbackNotice] = useState(
    () => offline && chosenStyle === "satellite",
  );
  const wasOfflineRef = useRef(offline);

  // The notice is raised on a network transition, not on every render. Keeping
  // the previous value in a ref makes the effect the only writer.
  useEffect(() => {
    if (wasOfflineRef.current === offline) return;
    wasOfflineRef.current = offline;
    setFallbackNotice(offline && chosenStyle === "satellite");
  }, [offline, chosenStyle]);

  const effectiveStyle: MapStyleId =
    offline && chosenStyle === "satellite" ? "standard" : chosenStyle;

  const chooseStyle = useCallback(
    (id: MapStyleId) => {
      if (!styles.includes(id)) return;
      setChosenStyle(id);
      guardedStorage.set(MAP_STYLE_KEY, id);
    },
    [styles],
  );

  const dismissFallbackNotice = useCallback(() => setFallbackNotice(false), []);

  return {
    chosenStyle,
    effectiveStyle,
    styles,
    offline,
    fallbackNotice,
    dismissFallbackNotice,
    chooseStyle,
  };
}
