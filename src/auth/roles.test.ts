import { describe, expect, it } from "vitest";
import { can, type Capability } from "./roles";
import type { Role } from "../api/types";

const matrix: Record<Role, Capability[]> = {
  admin: ["read", "mutate", "ack", "audit"],
  dispatcher: ["read", "mutate", "ack"],
  security: ["read", "ack", "audit"],
  viewer: ["read"],
};

const capabilities: Capability[] = ["read", "mutate", "ack", "audit"];

describe("role capability matrix", () => {
  it.each(Object.entries(matrix))("matches the table for %s", (role, allowed) => {
    for (const capability of capabilities) {
      expect(can(role as Role, capability), `${role} ${capability}`).toBe(
        allowed.includes(capability),
      );
    }
  });

  it("denies everything without a role", () => {
    for (const capability of capabilities) {
      expect(can(undefined, capability)).toBe(false);
    }
  });
});
