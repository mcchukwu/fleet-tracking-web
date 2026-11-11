import { z } from "zod";
import { ContractError } from "../errors/types";
import type { Driver } from "./types";

/** `phone` and `licence` arrive as `""` or omit the key; both mean "not set". */
const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => value ?? "");

export const driverRowSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  phone: optionalText,
  licence: optionalText,
  // An open string: an unknown status stays renderable with a neutral fallback.
  status: z.string().min(1),
  vehicles: z.number().int().nonnegative(),
});

export const driversResponseSchema = z.object({ data: z.array(z.unknown()) });

export interface DriversParseResult {
  drivers: Driver[];
  rejected: number;
}

/**
 * `GET /drivers` returns the whole list in `{ data: [] }`. A structurally
 * invalid row is dropped and counted; a payload where every row is unusable is
 * a contract error, not an empty tenant.
 */
export function parseDrivers(payload: unknown): DriversParseResult {
  const envelope = driversResponseSchema.safeParse(payload);
  if (!envelope.success) throw new ContractError("Drivers envelope is not { data: [] }");

  const drivers: Driver[] = [];
  let rejected = 0;
  for (const row of envelope.data.data) {
    const parsed = driverRowSchema.safeParse(row);
    if (parsed.success) drivers.push(parsed.data);
    else rejected += 1;
  }

  if (envelope.data.data.length > 0 && drivers.length === 0) {
    throw new ContractError("No driver row matched the expected shape");
  }
  return { drivers, rejected };
}
