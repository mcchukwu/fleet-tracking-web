export interface FleetMeta {
  scope?: "screen" | "panel" | "map" | "auth";
  resource?: string;
}

declare module "@tanstack/query-core" {
  interface Register {
    queryMeta: FleetMeta;
    mutationMeta: FleetMeta;
  }
}
