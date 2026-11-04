import type { Role } from "../api/types";

export type Capability = "read" | "mutate" | "ack" | "audit";

const capabilities: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set(["read", "mutate", "ack", "audit"]),
  dispatcher: new Set(["read", "mutate", "ack"]),
  security: new Set(["read", "ack", "audit"]),
  viewer: new Set(["read"]),
};

export function can(role: Role | undefined, capability: Capability): boolean {
  if (!role) return false;
  const allowed: ReadonlySet<Capability> | undefined = capabilities[role];
  return allowed?.has(capability) ?? false;
}
