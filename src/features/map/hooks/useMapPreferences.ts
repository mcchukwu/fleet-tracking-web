import { useCallback, useState } from "react";
import { guardedStorage } from "../../../lib/storage";

const GEOFENCES_KEY = "fleet.map.geofences";
const PANEL_KEY = "fleet.map.panel";

export interface MapPreferences {
  geofencesVisible: boolean;
  panelOpen: boolean;
  toggleGeofences: () => void;
  setGeofencesVisible: (visible: boolean) => void;
  setPanelOpen: (open: boolean) => void;
}

export function useMapPreferences(): MapPreferences {
  const [geofencesVisible, setGeofencesState] = useState(
    () => guardedStorage.get(GEOFENCES_KEY) !== "0",
  );
  const [panelOpen, setPanelOpenState] = useState(() => guardedStorage.get(PANEL_KEY) !== "0");

  const setGeofencesVisible = useCallback((visible: boolean) => {
    setGeofencesState(visible);
    guardedStorage.set(GEOFENCES_KEY, visible ? "1" : "0");
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
    guardedStorage.set(PANEL_KEY, open ? "1" : "0");
  }, []);

  const toggleGeofences = useCallback(() => {
    setGeofencesVisible(!geofencesVisible);
  }, [geofencesVisible, setGeofencesVisible]);

  return {
    geofencesVisible,
    panelOpen,
    toggleGeofences,
    setGeofencesVisible,
    setPanelOpen,
  };
}
