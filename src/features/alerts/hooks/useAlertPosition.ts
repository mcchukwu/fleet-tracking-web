import { useMemo } from "react";
import { useVehicleHistory } from "../../../api/hooks/vehicles";
import type { Alert, Geofence, Point } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { ALERT_POSITION_WINDOW_MS } from "../lib/constants";
import {
  evidenceCoordinates,
  geofenceForAlert,
  nearestPoint,
  type Position,
} from "../lib/position";

export type AlertPositionState =
  | { status: "evidence"; position: Position; geofence: Geofence | null }
  | { status: "history"; position: Position; point: Point; geofence: Geofence | null }
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error"; error: AppError };

export interface AlertPositionController {
  state: AlertPositionState;
  retry: () => void;
}

export function useAlertPosition(
  alert: Alert,
  geofences: readonly Geofence[],
): AlertPositionController {
  const evidence = evidenceCoordinates(alert.evidence);
  const geofence = geofenceForAlert(alert.evidence, geofences);
  const occurred = Date.parse(alert.occurred_at);
  const validOccurred = Number.isFinite(occurred);
  const range = useMemo(
    () => ({
      from: new Date(validOccurred ? occurred - ALERT_POSITION_WINDOW_MS : 0).toISOString(),
      to: new Date(validOccurred ? occurred + ALERT_POSITION_WINDOW_MS : 1).toISOString(),
      resolution: "30s" as const,
    }),
    [occurred, validOccurred],
  );

  const history = useVehicleHistory(
    evidence || !validOccurred ? undefined : alert.vehicle_id,
    range,
  );

  if (evidence) {
    return {
      state: { status: "evidence", position: evidence, geofence },
      retry: () => undefined,
    };
  }

  if (!validOccurred) {
    return { state: { status: "unavailable" }, retry: () => undefined };
  }

  if (history.isLoading) {
    return { state: { status: "loading" }, retry: () => void history.refetch() };
  }

  if (history.isError && !history.data) {
    return {
      state: { status: "error", error: normalize(history.error) },
      retry: () => void history.refetch(),
    };
  }

  const point = nearestPoint(
    history.data?.data ?? null,
    alert.occurred_at,
    ALERT_POSITION_WINDOW_MS,
  );
  if (!point) {
    return { state: { status: "unavailable" }, retry: () => void history.refetch() };
  }

  return {
    state: {
      status: "history",
      position: { lat: point.lat, lon: point.lon },
      point,
      geofence,
    },
    retry: () => void history.refetch(),
  };
}
