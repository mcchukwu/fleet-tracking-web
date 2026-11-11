import type { Driver, SnapshotVehicle } from "../api/types";

export type DriverStatus = "active" | "inactive";

export const driverStatusLabels: Record<DriverStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export function isDriverStatus(value: string | null | undefined): value is DriverStatus {
  return value !== null && value !== undefined && Object.hasOwn(driverStatusLabels, value);
}

export function driverStatusLabel(value: string): string {
  return isDriverStatus(value) ? driverStatusLabels[value] : `Unknown status: ${value}`;
}

export const driverStatusOptions: readonly DriverStatus[] = ["active", "inactive"];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, "");
}

export function activeDrivers(drivers: readonly Driver[]): Driver[] {
  return drivers.filter((driver) => driver.status === "active");
}

/**
 * Search runs over the whole list; the server ignores `q` and `status`.
 * Filtering ignores case, spaces and hyphens in every field.
 */
export function filterDrivers(
  drivers: readonly Driver[],
  query: string,
  status?: DriverStatus | null,
): Driver[] {
  const normalized = normalize(query);
  return drivers.filter((driver) => {
    if (status && driver.status !== status) return false;
    if (!normalized) return true;
    return normalize(`${driver.name} ${driver.phone} ${driver.licence}`).includes(normalized);
  });
}

/** The server's duplicate-name tie order is unspecified, so the client owns it. */
export function sortDrivers(drivers: readonly Driver[]): Driver[] {
  return [...drivers].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.phone.localeCompare(b.phone) ||
      a.licence.localeCompare(b.licence),
  );
}

/** Assignments come from the snapshot; the driver UUID is the join key. */
export function vehiclesForDriver(
  snapshot: readonly SnapshotVehicle[],
  driverId: string,
): SnapshotVehicle[] {
  return snapshot
    .filter((vehicle) => vehicle.driver_id === driverId)
    .sort((a, b) => a.plate.localeCompare(b.plate));
}

export function driverDescription(driver: Driver): string {
  const parts = [driver.phone, driver.licence].filter((part) => part !== "");
  return parts.join(" · ");
}

/** Duplicate names are common on staging, so the option carries phone and licence. */
export function driverOptionLabel(driver: Driver): string {
  const description = driverDescription(driver);
  return description ? `${driver.name} · ${description}` : driver.name;
}
