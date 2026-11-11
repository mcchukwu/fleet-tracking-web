import { describe, expect, it } from "vitest";
import type { Driver } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import {
  driverWriteCopy,
  reconcileCreatedDriver,
  reconcileDriverUpdate,
} from "./reconcile";

const drivers: Driver[] = [
  {
    id: "driver-1",
    name: "Adebayo Okafor",
    phone: "08031000010",
    licence: "LIC-01010",
    status: "active",
    vehicles: 1,
  },
];

const before = new Set(["driver-1"]);

function error(overrides: Partial<AppError>): AppError {
  return {
    kind: "network",
    retryable: true,
    outcome: "failed",
    context: { route: "/drivers" },
    at: 0,
    ...overrides,
  };
}

describe("driver reconciliation", () => {
  it("recognises a new row that matches the trimmed create input", () => {
    const created = {
      id: "driver-2",
      name: "Ada Obi",
      phone: "",
      licence: "",
      status: "active",
      vehicles: 0,
    };
    expect(
      reconcileCreatedDriver([...drivers, created], { name: "  Ada Obi " }, before),
    ).toBe("saved");
    expect(
      reconcileCreatedDriver(
        [...drivers, { ...created, phone: "0803 100 0010" }],
        { name: "Ada Obi", phone: "0803 100 0010" },
        before,
      ),
    ).toBe("saved");
  });

  it("ignores a pre-existing identical row", () => {
    expect(
      reconcileCreatedDriver(drivers, { name: "Adebayo Okafor", phone: "08031000010" }, before),
    ).toBe("not_saved");
  });

  it("reports not saved when no new row matches", () => {
    expect(reconcileCreatedDriver(drivers, { name: "Ada Obi" }, before)).toBe("not_saved");
  });

  it("compares every intended update field", () => {
    expect(reconcileDriverUpdate(drivers[0], { phone: "08031000010" })).toBe("saved");
    expect(reconcileDriverUpdate(drivers[0], { phone: "08031000011" })).toBe("not_saved");
    expect(reconcileDriverUpdate(drivers[0], { name: "  Adebayo Okafor  " })).toBe("saved");
    expect(reconcileDriverUpdate(drivers[0], { status: "inactive" })).toBe("not_saved");
  });

  it("treats an absent row as an unknown outcome", () => {
    expect(reconcileDriverUpdate(undefined, { phone: "08031000011" })).toBe("unknown");
  });
});

describe("driver write copy", () => {
  it("covers validation with the safe server message", () => {
    const copy = driverWriteCopy(
      error({ kind: "validation", status: 400, code: "invalid_status", serverMessage: "status must be active or inactive" }),
      "update",
    );
    expect(copy.detail).toContain("status must be active or inactive");
    expect(copy.title).toBe("Check the highlighted fields");
  });

  it("covers forbidden, not found, network and unknown outcomes", () => {
    expect(driverWriteCopy(error({ kind: "forbidden" }), "create").title).toBe(
      "Your role can't create drivers.",
    );
    expect(driverWriteCopy(error({ kind: "forbidden" }), "update").title).toBe(
      "Your role can't edit drivers.",
    );
    expect(driverWriteCopy(error({ kind: "not_found" }), "update").title).toBe(
      "This driver no longer exists.",
    );
    expect(driverWriteCopy(error({ kind: "network" }), "update").title).toBe("It wasn't saved.");
    expect(driverWriteCopy(error({ kind: "timeout" }), "create").detail).toBe("Try again.");
    expect(
      driverWriteCopy(error({ kind: "network", outcome: "unknown" }), "create").title,
    ).toBe("We couldn't confirm that it saved.");
  });

  it("covers an expired session", () => {
    expect(driverWriteCopy(error({ kind: "unauthenticated" }), "create").title).toBe(
      "Your session expired",
    );
  });
});
