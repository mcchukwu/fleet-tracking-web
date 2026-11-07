import type { Driver } from "../../../api/types";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, "");
}

export function activeDrivers(drivers: readonly Driver[]): Driver[] {
  return drivers.filter((driver) => driver.status === "active");
}

export function filterDrivers(drivers: readonly Driver[], query: string): Driver[] {
  const normalized = normalize(query);
  if (!normalized) return [...drivers];
  return drivers.filter((driver) =>
    normalize(`${driver.name} ${driver.phone} ${driver.licence}`).includes(normalized),
  );
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
