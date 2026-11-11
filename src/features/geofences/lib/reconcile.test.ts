import { describe, expect, it } from "vitest";
import type { Geofence, GeofenceInput } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import type { LngLat } from "../../../map/types";
import {
  findCreatedGeofence,
  geofenceDeleteCopy,
  geofenceWriteCopy,
  reconcileCreatedGeofence,
  reconcileGeofenceDelete,
  reconcileGeofenceUpdate,
} from "./reconcile";

const ring: LngLat[] = [
  [3.4, 6.4],
  [3.5, 6.4],
  [3.5, 6.5],
  [3.4, 6.4],
];

const existing: Geofence = {
  id: "gf-1",
  name: "Lekki Depot",
  kind: "depot",
  geometry: { type: "Polygon", coordinates: [ring] },
};

const input: GeofenceInput = {
  name: "  Refinery Gate ",
  kind: "restricted",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [3.38, 6.44],
        [3.4, 6.44],
        [3.4, 6.455],
        [3.38, 6.44],
      ],
    ],
  },
};

describe("reconcileCreatedGeofence", () => {
  it("matches a new id with the trimmed name, kind and geometry", () => {
    expect(
      reconcileCreatedGeofence(
        [
          existing,
          {
            id: "gf-2",
            name: "Refinery Gate",
            kind: "restricted",
            geometry: input.geometry,
          },
        ],
        input,
        new Set(["gf-1"]),
      ),
    ).toBe("saved");
  });

  it("ignores an identical pre-existing row", () => {
    expect(
      reconcileCreatedGeofence(
        [
          {
            id: "gf-1",
            name: "Refinery Gate",
            kind: "restricted",
            geometry: input.geometry,
          },
        ],
        input,
        new Set(["gf-1"]),
      ),
    ).toBe("not_saved");
  });

  it("does not accept a duplicate name with a different geometry", () => {
    expect(
      reconcileCreatedGeofence(
        [
          {
            id: "gf-2",
            name: "Refinery Gate",
            kind: "restricted",
            geometry: existing.geometry,
          },
        ],
        input,
        new Set(["gf-1"]),
      ),
    ).toBe("not_saved");
  });

  it("treats a missing kind as the server default other", () => {
    expect(
      reconcileCreatedGeofence(
        [
          {
            id: "gf-2",
            name: "Refinery Gate",
            kind: "other",
            geometry: input.geometry,
          },
        ],
        { name: "Refinery Gate", geometry: input.geometry },
        new Set(["gf-1"]),
      ),
    ).toBe("saved");
  });

  it("returns the created row's id so the page can focus it", () => {
    const row = findCreatedGeofence(
      [
        existing,
        {
          id: "gf-2",
          name: "Refinery Gate",
          kind: "restricted",
          geometry: input.geometry,
        },
      ],
      input,
      new Set(["gf-1"]),
    );
    expect(row?.id).toBe("gf-2");
  });
});

describe("reconcileGeofenceUpdate", () => {
  it("compares every intended field", () => {
    expect(
      reconcileGeofenceUpdate(
        [{ ...existing, name: "Lekki Gate", kind: "customer" }],
        "gf-1",
        { name: "Lekki Gate", kind: "customer" },
      ),
    ).toBe("saved");
  });

  it("reports not saved when a field differs", () => {
    expect(reconcileGeofenceUpdate([existing], "gf-1", { name: "Lekki Gate" })).toBe(
      "not_saved",
    );
  });

  it("reports unknown when the id is absent", () => {
    expect(reconcileGeofenceUpdate([], "gf-1", { name: "Lekki Gate" })).toBe("unknown");
  });
});

describe("reconcileGeofenceDelete", () => {
  it("is saved when the id is absent", () => {
    expect(reconcileGeofenceDelete([], "gf-1")).toBe("saved");
  });

  it("is not saved while the id is still present", () => {
    expect(reconcileGeofenceDelete([existing], "gf-1")).toBe("not_saved");
  });
});

function error(overrides: Partial<AppError>): AppError {
  return {
    kind: "network",
    retryable: true,
    outcome: "failed",
    context: { route: "/geofences" },
    at: 0,
    ...overrides,
  };
}

describe("geofenceWriteCopy", () => {
  it("names the polygon for each validation code", () => {
    expect(
      geofenceWriteCopy(
        error({ kind: "validation", code: "invalid_geometry", serverMessage: "geometry must be a valid polygon" }),
        "create",
      ),
    ).toEqual({
      title: "The polygon isn't valid.",
      detail: "geometry must be a valid polygon",
    });
    expect(
      geofenceWriteCopy(
        error({ kind: "validation", code: "invalid_kind", serverMessage: "kind must be depot, customer, restricted or other" }),
        "update",
      ),
    ).toEqual({
      title: "Choose a kind.",
      detail: "kind must be depot, customer, restricted or other",
    });
  });

  it("falls back to the catalog for other validation and request errors", () => {
    expect(
      geofenceWriteCopy(error({ kind: "validation", code: "invalid_request", serverMessage: "name and geometry are required" }), "create").detail,
    ).toBe("name and geometry are required");
  });

  it("explains a missing geofence", () => {
    expect(geofenceWriteCopy(error({ kind: "not_found" }), "update").title).toBe(
      "This geofence no longer exists.",
    );
  });

  it("explains a role refusal", () => {
    expect(geofenceWriteCopy(error({ kind: "forbidden" }), "create").title).toContain("role");
  });

  it("asks the user to sign in after an expired session", () => {
    expect(geofenceWriteCopy(error({ kind: "unauthenticated" }), "update").detail).toContain(
      "Sign in",
    );
  });

  it("distinguishes unknown, failed and saved writes", () => {
    expect(geofenceWriteCopy(error({ kind: "timeout" }), "create").title).toBe(
      "It wasn't saved.",
    );
    expect(geofenceWriteCopy(error({ kind: "network" }), "create").detail).toBe("Try again.");
    const unknown = geofenceWriteCopy(
      error({ kind: "timeout", outcome: "unknown" }),
      "update",
    );
    expect(unknown.title).toContain("couldn't confirm");
    expect(unknown.detail).toContain("Check the geofences list");
  });
});

describe("geofenceDeleteCopy", () => {
  it("keeps the fixed headline and quotes the real in_use message", () => {
    expect(
      geofenceDeleteCopy(
        error({
          kind: "conflict",
          code: "in_use",
          serverMessage: "geofence has events and cannot be deleted",
        }),
      ),
    ).toEqual({
      title: "This geofence has recorded events and can't be deleted.",
      detail: "geofence has events and cannot be deleted",
    });
  });

  it("explains a missing geofence", () => {
    expect(geofenceDeleteCopy(error({ kind: "not_found" })).title).toBe(
      "This geofence no longer exists.",
    );
  });

  it("explains a role refusal", () => {
    expect(geofenceDeleteCopy(error({ kind: "forbidden" })).title).toContain("role");
  });

  it("asks the user to sign in after an expired session", () => {
    expect(geofenceDeleteCopy(error({ kind: "unauthenticated" })).detail).toContain("Sign in");
  });

  it("distinguishes unknown, failed and conflict outcomes", () => {
    expect(geofenceDeleteCopy(error({ kind: "network" })).title).toBe(
      "It wasn't deleted.",
    );
    const unknown = geofenceDeleteCopy(error({ kind: "timeout", outcome: "unknown" }));
    expect(unknown.title).toContain("couldn't confirm");
    expect(unknown.detail).toContain("Check the geofences list");
    expect(geofenceDeleteCopy(error({ kind: "conflict", code: "conflict" })).title).toContain(
      "Couldn't",
    );
  });
});
