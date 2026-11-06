import { useCallback, useState } from "react";
import { availableMapStyles } from "../../../map/config";
import type { MapStyleId } from "../../../map/types";
import { guardedStorage } from "../../../lib/storage";
import { useConnection } from "../../../stores/connection";

export const MAP_STYLE_KEY = "fleet.map.style";

function readStyle(styles: readonly MapStyleId[]): MapStyleId {
  const stored = guardedStorage.get(MAP_STYLE_KEY);
  return styles.includes(stored as MapStyleId) ? (stored as MapStyleId) : "standard";
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
  const [wasOffline, setWasOffline] = useState(offline);

  // Network changes are the only event that raises or clears the notice, so the
  // transition is derived during render instead of synchronised in an effect.
  if (wasOffline !== offline) {
    setWasOffline(offline);
    setFallbackNotice(offline && chosenStyle === "satellite");
  }

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
