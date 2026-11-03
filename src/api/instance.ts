import { FleetApiClient } from "./client";

export const api = new FleetApiClient(import.meta.env.VITE_API_BASE ?? "");
