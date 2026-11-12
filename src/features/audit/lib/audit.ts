import type { AuditEntry } from "../../../api/types";
import { formatEvidenceValue, humanizeEvidenceKey } from "../../../lib/evidence";
import { MISSING } from "../../../lib/format";

const actionLabels: Record<string, string> = {
  "auth.login": "Login",
  "alert.ack": "Acknowledge alert",
  "driver.create": "Create driver",
  "driver.update": "Update driver",
  "geofence.create": "Create geofence",
  "geofence.update": "Update geofence",
  "geofence.delete": "Delete geofence",
  "import.vehicles": "Import vehicles",
  "trip.create": "Create trip",
  "trip.update": "Update trip",
  "trip.complete": "Complete trip",
  "vehicle.update": "Update vehicle",
};

const entityLabels: Record<string, string> = {
  user: "User",
  alert: "Alert",
  driver: "Driver",
  geofence: "Geofence",
  import_job: "Import job",
  trip: "Trip",
  vehicle: "Vehicle",
};

function humanizeToken(value: string): string {
  const words = value.replace(/[._-]+/g, " ").trim();
  if (!words) return value;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function auditActionLabel(action: string): string {
  if (!action.trim()) return MISSING;
  return actionLabels[action] ?? humanizeToken(action);
}

export function auditEntityLabel(entity: string): string {
  if (!entity.trim()) return MISSING;
  return entityLabels[entity] ?? humanizeToken(entity);
}

export interface AuditActionOption {
  value: string;
  label: string;
}

/** Options grow with the loaded pages; an active value never falls out. */
export function auditActionOptions(
  entries: readonly AuditEntry[],
  current: string | null,
): AuditActionOption[] {
  const values = new Set(entries.map((entry) => entry.action));
  if (current) values.add(current);
  return [...values]
    .map((value) => ({ value, label: auditActionLabel(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function normalizeAuditQuery(query: string): string {
  return query.trim().toLowerCase();
}

export interface AuditFilterValues {
  action: string | null;
  q: string;
}

function searchableText(entry: AuditEntry): string {
  return [
    entry.user_name,
    entry.action,
    auditActionLabel(entry.action),
    entry.entity,
    auditEntityLabel(entry.entity),
    entry.entity_id,
    String(entry.id),
    metadataSummary(entry.metadata),
  ]
    .join(" ")
    .toLowerCase();
}

export function filterAuditEntries(
  entries: readonly AuditEntry[],
  filters: AuditFilterValues,
): AuditEntry[] {
  const query = normalizeAuditQuery(filters.q);
  return entries.filter((entry) => {
    if (filters.action && entry.action !== filters.action) return false;
    return query === "" || searchableText(entry).includes(query);
  });
}

function compareIds(a: AuditEntry["id"], b: AuditEntry["id"]): number {
  if (typeof a === "number" && typeof b === "number") return b - a;
  return String(b).localeCompare(String(a), undefined, { numeric: true });
}

/** Newest first with id descending as the tie-break; an invalid time sorts last. */
export function sortAuditEntries(entries: readonly AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = Date.parse(a.created_at);
    const bTime = Date.parse(b.created_at);
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);
    if (aValid && bValid && aTime !== bTime) return bTime - aTime;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return compareIds(a.id, b.id);
  });
}

/** A refresh shifts offsets, so pages can overlap. Keep the first (newest) copy. */
export function flattenAuditPages(pages: readonly (readonly AuditEntry[])[]): AuditEntry[] {
  const byId = new Map<string, AuditEntry>();
  for (const page of pages) {
    for (const entry of page) {
      const key = String(entry.id);
      if (!byId.has(key)) byId.set(key, entry);
    }
  }
  return sortAuditEntries([...byId.values()]);
}

function metadataValue(key: string, value: unknown): string {
  if (typeof value === "string") return value === "" ? MISSING : value;
  return formatEvidenceValue(key, value);
}

/** One table line; the drawer owns the full key-value list. */
export function metadataSummary(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return MISSING;
  return entries
    .map(([key, value]) => {
      if ((key === "imported" || key === "failed") && typeof value === "number") {
        return `${value} ${key}`;
      }
      if (key === "vehicle_id") return `Vehicle: ${metadataValue(key, value)}`;
      return `${humanizeEvidenceKey(key)}: ${metadataValue(key, value)}`;
    })
    .join(" · ");
}

export type AuditEmptyReason =
  | "offline"
  | "no-data"
  | "no-results"
  | "no-loaded-matches";

export interface AuditEmptyInput {
  loadedCount: number;
  visibleCount: number;
  hasMore: boolean;
  filtered: boolean;
  online: boolean;
}

export function emptyAuditReason(input: AuditEmptyInput): AuditEmptyReason | null {
  if (input.visibleCount > 0) return null;
  if (!input.online && input.loadedCount === 0) return "offline";
  if (input.loadedCount === 0) return "no-data";
  if (!input.filtered) return "no-data";
  return input.hasMore ? "no-loaded-matches" : "no-results";
}

export function findAuditEntry(
  entries: readonly AuditEntry[],
  id: string | null,
): AuditEntry | null {
  if (id === null) return null;
  return entries.find((entry) => String(entry.id) === id) ?? null;
}
