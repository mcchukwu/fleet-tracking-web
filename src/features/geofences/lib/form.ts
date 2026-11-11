import { z } from "zod";
import type { GeofenceInput, GeofenceUpdate } from "../../../api/types";
import type { LngLat } from "../../../map/types";
import { geometryEquals, toPolygon, validateRing } from "./geometry";
import { GEOFENCE_KIND_ORDER } from "./kinds";

export const geofenceFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  kind: z.enum(GEOFENCE_KIND_ORDER, { error: "Choose a kind." }),
});

export type GeofenceFormValues = z.infer<typeof geofenceFormSchema>;
export type GeofenceKindValue = GeofenceFormValues["kind"];

export const GEOFENCE_FORM_DEFAULT: GeofenceFormValues = {
  name: "",
  kind: "depot",
};

export interface GeofenceEditBaseline {
  name: string;
  kind: GeofenceKindValue;
  ring: readonly LngLat[];
}

/** The ring is validated here as a final gate; an invalid ring never becomes a payload. */
export function toCreateInput(
  values: GeofenceFormValues,
  ring: readonly LngLat[],
): GeofenceInput | null {
  const validated = validateRing(ring);
  if (!validated.ok) return null;
  return {
    name: values.name.trim(),
    kind: values.kind,
    geometry: toPolygon(validated.ring),
  };
}

/** Sends only fields that differ from the baseline; an unchanged edit is an empty object. */
export function toUpdateInput(
  baseline: GeofenceEditBaseline,
  values: GeofenceFormValues,
  ring: readonly LngLat[],
): GeofenceUpdate | null {
  const validated = validateRing(ring);
  if (!validated.ok) return null;

  const update: GeofenceUpdate = {};
  const name = values.name.trim();
  if (name !== baseline.name.trim()) update.name = name;
  if (values.kind !== baseline.kind) update.kind = values.kind;

  const geometry = toPolygon(validated.ring);
  if (!geometryEquals(geometry, toPolygon(baseline.ring))) update.geometry = geometry;
  return update;
}
