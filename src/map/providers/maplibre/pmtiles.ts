import { Protocol } from "pmtiles";
import { addMapProtocol } from "./sdk";

type ProtocolRegister = (name: string, handler: Parameters<typeof addMapProtocol>[1]) => void;

let registered = false;

/** Registers the `pmtiles://` protocol inside the provider boundary, once. */
export function registerPmtilesProtocol(register: ProtocolRegister = addMapProtocol): void {
  if (registered) return;
  const protocol = new Protocol();
  register("pmtiles", protocol.tile);
  registered = true;
}

/** Test seam: protocol registration is process-wide. */
export function resetPmtilesProtocolForTests(): void {
  registered = false;
}
