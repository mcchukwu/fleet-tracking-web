import type { Alert } from "../../../api/types";
import { sortNewestFirst } from "./filter";

export interface FeedView {
  visible: Alert[];
  pending: Alert[];
  newCount: number;
  highlightIds: ReadonlySet<string>;
}

export function flattenPages(pages: readonly (readonly Alert[])[]): Alert[] {
  const byId = new Map<string, Alert>();
  for (const page of pages) {
    for (const alert of page) byId.set(alert.id, alert);
  }
  return sortNewestFirst([...byId.values()]);
}

function occurredAt(alert: Alert): number {
  const at = Date.parse(alert.occurred_at);
  return Number.isNaN(at) ? -Infinity : at;
}

/**
 * New rows only arrive at the head. While scrolled, the visible order is
 * frozen and arrivals wait in a pending set; older pages loaded by "Load more"
 * are not treated as new alerts.
 */
export function nextFeedView(input: {
  previousVisible: readonly Alert[];
  previousPendingIds: ReadonlySet<string>;
  incoming: readonly Alert[];
  atTop: boolean;
  reset: boolean;
}): FeedView {
  const { previousVisible, previousPendingIds, incoming, atTop, reset } = input;

  if (reset) {
    return { visible: [...incoming], pending: [], newCount: 0, highlightIds: new Set() };
  }

  const previousIds = new Set(previousVisible.map((alert) => alert.id));

  if (atTop) {
    const highlightIds = new Set<string>();
    if (previousVisible.length > 0) {
      for (const alert of incoming) {
        if (!previousIds.has(alert.id) || previousPendingIds.has(alert.id)) {
          highlightIds.add(alert.id);
        }
      }
    }
    return { visible: [...incoming], pending: [], newCount: 0, highlightIds };
  }

  const newestPrevious = previousVisible.reduce(
    (latest, alert) => Math.max(latest, occurredAt(alert)),
    -Infinity,
  );
  const pendingIds = new Set<string>();
  for (const alert of incoming) {
    if (previousPendingIds.has(alert.id)) {
      pendingIds.add(alert.id);
      continue;
    }
    if (previousIds.has(alert.id)) continue;
    if (occurredAt(alert) > newestPrevious) pendingIds.add(alert.id);
  }
  const pending = incoming.filter((alert) => pendingIds.has(alert.id));
  // Older pages load below the frozen head; only arrivals above it wait.
  const visible = incoming.filter((alert) => !pendingIds.has(alert.id));

  return { visible, pending, newCount: pending.length, highlightIds: new Set() };
}
