import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "../api/types";
import { useAuthStore } from "./store";
import { useCanMutate } from "./useCanMutate";
import { useConnectionStore } from "../stores/connection";

function signIn(role: Role, options: { verified?: boolean } = {}): void {
  useAuthStore.getState().setSession(
    {
      id: "user-1",
      tenant_id: "tenant-1",
      email: "person@example.test",
      name: "Person",
      role,
    },
    "csrf-token",
  );
  if (options.verified === false) {
    useAuthStore.setState({ sessionVerified: false, csrfToken: null });
  }
}

beforeEach(() => {
  useAuthStore.getState().clear();
  useConnectionStore.setState({ network: "online" });
});

describe("useCanMutate", () => {
  it("allows a verified dispatcher online", () => {
    signIn("dispatcher");
    const { result } = renderHook(() => useCanMutate("mutate", "Your role can't edit vehicles."));

    expect(result.current).toEqual({
      allowed: true,
      roleAllowed: true,
      blockedBy: null,
      reason: null,
    });
  });

  it("blocks a viewer by role and keeps the caller's reason", () => {
    signIn("viewer");
    const { result } = renderHook(() => useCanMutate("mutate", "Your role can't edit vehicles."));

    expect(result.current.allowed).toBe(false);
    expect(result.current.roleAllowed).toBe(false);
    expect(result.current.blockedBy).toBe("role");
    expect(result.current.reason).toBe("Your role can't edit vehicles.");
  });

  it("blocks every role without a session", () => {
    const { result } = renderHook(() => useCanMutate("ack"));
    expect(result.current.blockedBy).toBe("role");
    expect(result.current.reason).toBe("Your role can't make changes.");
  });

  it("honours the ack capability matrix", () => {
    signIn("security");
    const { result } = renderHook(() => useCanMutate("ack"));
    expect(result.current.allowed).toBe(true);

    signIn("viewer");
    const denied = renderHook(() => useCanMutate("ack"));
    expect(denied.result.current.allowed).toBe(false);
  });

  it("blocks a verified session offline with the exact copy", () => {
    signIn("admin");
    useConnectionStore.setState({ network: "offline" });
    const { result } = renderHook(() => useCanMutate("mutate"));

    expect(result.current.roleAllowed).toBe(true);
    expect(result.current.blockedBy).toBe("offline");
    expect(result.current.reason).toBe("You're offline.");
  });

  it("blocks an unverified session online", () => {
    signIn("admin", { verified: false });
    const { result } = renderHook(() => useCanMutate("mutate"));

    expect(result.current.blockedBy).toBe("unverified");
    expect(result.current.reason).toBe("Your session isn't verified yet.");
  });

  it("prefers role, then offline, then unverified", () => {
    signIn("viewer", { verified: false });
    useConnectionStore.setState({ network: "offline" });
    const { result } = renderHook(() => useCanMutate("mutate", "Role reason."));
    expect(result.current.blockedBy).toBe("role");

    signIn("dispatcher", { verified: false });
    const offline = renderHook(() => useCanMutate("mutate", "Role reason."));
    expect(offline.result.current.blockedBy).toBe("offline");
  });
});
