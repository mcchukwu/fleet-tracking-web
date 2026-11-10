export type BannerKind =
  | "session-expired"
  | "offline"
  | "unavailable"
  | "storm"
  | "reconnecting"
  | "update";

/**
 * One banner slot, highest first. Session expiry is blocking, so its banner is
 * the message behind the re-sign-in dialog; the dialog remains the action.
 */
export const BANNER_PRIORITY: readonly BannerKind[] = [
  "session-expired",
  "offline",
  "unavailable",
  "storm",
  "reconnecting",
  "update",
];

export function highestPriorityBanner(
  present: Iterable<BannerKind>,
): BannerKind | null {
  const candidates = new Set(present);
  return BANNER_PRIORITY.find((kind) => candidates.has(kind)) ?? null;
}
