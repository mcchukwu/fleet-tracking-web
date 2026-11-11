import type { GeofenceKind } from "../../../api/types";

export const GEOFENCE_KIND_ORDER = [
  "depot",
  "customer",
  "restricted",
  "other",
] as const satisfies readonly GeofenceKind[];

export const GEOFENCE_KIND_LABELS: Record<GeofenceKind, string> = {
  depot: "Depot",
  customer: "Customer",
  restricted: "Restricted",
  other: "Other",
};

export const GEOFENCE_KIND_STROKES: Record<GeofenceKind, string> = {
  depot: "Solid line",
  customer: "Dotted line",
  restricted: "Dashed line with diagonal hatch",
  other: "Thin solid line",
};

const SWATCH_CLASSES: Record<GeofenceKind, string> = {
  depot: "border-gf-depot border-t-2 border-solid",
  customer: "border-gf-customer border-t-2 border-dotted",
  restricted: "border-gf-restricted border-t-2 border-dashed",
  other: "border-gf-other border-t border-solid",
};

export interface GeofenceKindInfo {
  id: GeofenceKind;
  label: string;
  stroke: string;
  swatchClassName: string;
}

export function isGeofenceKind(value: string): value is GeofenceKind {
  return (GEOFENCE_KIND_ORDER as readonly string[]).includes(value);
}

/** Unknown kinds degrade to the neutral Other badge rather than dropping the row. */
export function geofenceKindInfo(kind: string): GeofenceKindInfo {
  const id: GeofenceKind = isGeofenceKind(kind) ? kind : "other";
  return {
    id,
    label: GEOFENCE_KIND_LABELS[id],
    stroke: GEOFENCE_KIND_STROKES[id],
    swatchClassName: SWATCH_CLASSES[id],
  };
}
