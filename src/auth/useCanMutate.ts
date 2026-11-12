import { can } from "./roles";
import { useAuthStore } from "./store";
import { useConnectionStore } from "../stores/connection";

export type MutateCapability = "mutate" | "ack";

export type MutateBlock = "role" | "offline" | "unverified" | null;

export interface MutatePermission {
  allowed: boolean;
  roleAllowed: boolean;
  blockedBy: MutateBlock;
  reason: string | null;
}

const DEFAULT_ROLE_REASON = "Your role can't make changes.";
export const OFFLINE_REASON = "You're offline.";
export const UNVERIFIED_REASON = "Your session isn't verified yet.";

/**
 * The single gate for every mutating control: role, then network, then session
 * verification. `roleAllowed` drives forbidden states; `blockedBy` separates a
 * neutral offline notice from a role refusal.
 */
export function useCanMutate(
  capability: MutateCapability = "mutate",
  roleReason: string = DEFAULT_ROLE_REASON,
): MutatePermission {
  const role = useAuthStore((state) => state.user?.role);
  const verified = useAuthStore((state) => state.sessionVerified);
  const network = useConnectionStore((state) => state.network);

  const roleAllowed = can(role, capability);
  if (!roleAllowed) {
    return { allowed: false, roleAllowed, blockedBy: "role", reason: roleReason };
  }
  if (network === "offline") {
    return { allowed: false, roleAllowed, blockedBy: "offline", reason: OFFLINE_REASON };
  }
  if (!verified) {
    return { allowed: false, roleAllowed, blockedBy: "unverified", reason: UNVERIFIED_REASON };
  }
  return { allowed: true, roleAllowed, blockedBy: null, reason: null };
}
