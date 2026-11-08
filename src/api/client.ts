import type { ZodType } from "zod";
import {
  ApiError,
  ContractError,
  isApiError,
  TimeoutError,
  type AppError,
} from "../errors/types";
import { normalize } from "../errors/normalize";
import { recordError, recordSessionCheckSuccess } from "../errors/report";
import { endpointTimeouts } from "./timeouts";
import {
  auditResponseSchema,
  errorResponseSchema,
  historyResponseSchema,
  importResultSchema,
  loginResponseSchema,
  parseAlertRules,
  parseAlerts,
  parseGeofences,
  parseSnapshot,
  parseVehicleEventsResponse,
  parseVehicleResponse,
  systemHealthSchema,
  type AuditResponse,
  type SystemHealth,
} from "./schemas";
import type {
  AlertFilters,
  AuditFilters,
  Driver,
  DriverInput,
  DriverUpdate,
  GeofenceInput,
  HistoryRange,
  ImportResult,
  LoginResponse,
  ReportSummary,
  Trip,
  TripFilters,
  TripInput,
  TripUpdate,
  Vehicle,
  VehicleEventRange,
  VehicleFilters,
  VehicleUpdate,
} from "./types";

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface SessionHandlers {
  onSessionExpired?: () => void;
  refreshCsrf?: () => Promise<string | null>;
}

const DEFAULT_TIMEOUT_MS = endpointTimeouts.default;
const UPLOAD_TIMEOUT_MS = endpointTimeouts.upload;
const HISTORY_TIMEOUT_MS = endpointTimeouts.history;

function currentRoute(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function queryString(values: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value !== "") params.set(key, value);
    if (typeof value === "number") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function faultOverride(): string | null {
  if (!import.meta.env.DEV || import.meta.env.VITE_MOCK !== "1") return null;
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("fault");
}

export class FleetApiClient {
  private csrfToken = "";
  private handlers: SessionHandlers = {};
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    baseUrl = import.meta.env.VITE_API_BASE ?? "",
    fetcher: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl;
    this.fetcher = fetcher.bind(globalThis);
  }

  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  setSessionHandlers(handlers: SessionHandlers): void {
    this.handlers = handlers;
  }

  liveUrl(): string {
    const base = this.baseUrl || window.location.origin;
    const url = new URL(`${base}/api/v1/live/ws`, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }

  private url(path: string): string {
    const fault = faultOverride();
    const target = fault
      ? `${path}${path.includes("?") ? "&" : "?"}fault=${encodeURIComponent(fault)}`
      : path;
    return `${this.baseUrl.replace(/\/$/, "")}/api/v1${target}`;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    try {
      return await this.send<T>(method, path, body, options, true);
    } catch (cause) {
      const error = normalize(
        cause,
        { route: currentRoute(), resource: path.split("?")[0] },
        { outcome: method === "GET" ? "failed" : "unknown" },
      );
      if (
        method !== "GET" &&
        error.outcome === "unknown" &&
        error.kind !== "network" &&
        error.kind !== "timeout"
      ) {
        throw { ...error, outcome: "failed" };
      }
      throw error;
    }
  }

  private async send<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body: unknown,
    options: RequestOptions,
    allowCsrfRetry: boolean,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener("abort", abortFromCaller);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (method !== "GET" && this.csrfToken) {
      headers["X-CSRF-Token"] = this.csrfToken;
    }

    let response: Response;
    try {
      response = await this.fetcher(this.url(path), {
        method,
        credentials: "include",
        headers,
        signal: controller.signal,
        ...(body instanceof FormData
          ? { body }
          : body === undefined
            ? {}
            : { body: JSON.stringify(body) }),
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        if (options.signal?.aborted) throw new DOMException("aborted", "AbortError");
        throw new TimeoutError(`Request exceeded ${timeoutMs}ms`);
      }
      throw cause;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }

    if (response.status === 401 && path !== "/auth/login") {
      this.handlers.onSessionExpired?.();
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let payload: unknown;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new SyntaxError(`Response from ${path} was not valid JSON`);
      }
    }

    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(payload);
      const code = parsed.success ? parsed.data.error.code : "request_failed";
      const message = parsed.success ? parsed.data.error.message : response.statusText;

      if (response.status === 403 && code === "csrf_failed") {
        if (allowCsrfRetry && this.handlers.refreshCsrf) {
          const token = await this.handlers.refreshCsrf().catch(() => null);
          if (token) {
            this.csrfToken = token;
            return this.send<T>(method, path, body, options, false);
          }
        }
        throw new ApiError(403, "forbidden", "Your session could not be verified");
      }

      throw new ApiError(
        response.status,
        code,
        message,
        parseRetryAfter(response.headers.get("Retry-After")),
        response.headers.get("X-Request-Id") ?? undefined,
      );
    }

    return payload as T;
  }

  private async validated<T>(response: Promise<unknown>, schema: ZodType<T>): Promise<T> {
    try {
      return schema.parse(await response);
    } catch (cause) {
      if (isApiError(cause)) throw cause;
      throw normalize(cause, { route: currentRoute() });
    }
  }

  private parse<T>(payload: unknown, resource: string, parse: (value: unknown) => T): T {
    try {
      return parse(payload);
    } catch (cause) {
      throw normalize(cause, { route: currentRoute(), resource, action: "read" });
    }
  }

  private noteRejectedRows(resource: string, rejected: number): void {
    if (rejected <= 0) return;
    recordError(
      normalize(new ContractError(`${rejected} row(s) did not match the contract`), {
        route: currentRoute(),
        resource,
        action: "parse",
      }),
    );
  }

  async login(email: string, password: string, options: RequestOptions = {}): Promise<LoginResponse> {
    const result = await this.validated(
      this.request<unknown>("POST", "/auth/login", { email, password }, options),
      loginResponseSchema,
    );
    this.csrfToken = result.csrf_token;
    return result;
  }

  async logout(options: RequestOptions = {}): Promise<void> {
    try {
      await this.request<void>("POST", "/auth/logout", undefined, options);
    } finally {
      this.csrfToken = "";
    }
  }

  async me(options: RequestOptions = {}): Promise<LoginResponse> {
    const result = await this.validated(
      this.request<unknown>("GET", "/me", undefined, options),
      loginResponseSchema,
    );
    recordSessionCheckSuccess();
    this.csrfToken = result.csrf_token;
    return result;
  }

  vehicles(filters: VehicleFilters = {}, options: RequestOptions = {}) {
    return this.request<{ data: Vehicle[] }>("GET", `/vehicles${queryString(filters)}`, undefined, options);
  }

  async vehicle(id: string, options: RequestOptions = {}) {
    const payload = await this.request<unknown>("GET", `/vehicles/${id}`, undefined, options);
    return { data: this.parse(payload, "/vehicles", parseVehicleResponse) };
  }

  updateVehicle(id: string, update: VehicleUpdate, options: RequestOptions = {}) {
    return this.request<void>("PATCH", `/vehicles/${id}`, update, options);
  }

  async vehicleEvents(id: string, range: VehicleEventRange = {}, options: RequestOptions = {}) {
    const payload = await this.request<unknown>(
      "GET",
      `/vehicles/${id}/events${queryString(range)}`,
      undefined,
      options,
    );
    const result = this.parse(payload, "/vehicles/:id/events", parseVehicleEventsResponse);
    this.noteRejectedRows("/vehicles/:id/events", result.rejected);
    return { data: result.events };
  }

  async history(id: string, range: HistoryRange = {}, options: RequestOptions = {}) {
    const payload = await this.request<unknown>(
      "GET",
      `/vehicles/${id}/history${queryString(range)}`,
      undefined,
      { ...options, timeoutMs: options.timeoutMs ?? HISTORY_TIMEOUT_MS },
    );
    return this.parse(payload, "/vehicles/:id/history", (value) =>
      historyResponseSchema.parse(value),
    );
  }

  async liveSnapshot(options: RequestOptions = {}) {
    const payload = await this.request<unknown>("GET", "/live/snapshot", undefined, options);
    const result = this.parse(payload, "/live/snapshot", parseSnapshot);
    this.noteRejectedRows("/live/snapshot", result.rejected);
    return { data: result.vehicles };
  }

  trips(filters: TripFilters = {}, options: RequestOptions = {}) {
    return this.request<{ data: Trip[] }>("GET", `/trips${queryString(filters)}`, undefined, options);
  }

  createTrip(input: TripInput, options: RequestOptions = {}) {
    return this.request<{ id: string }>("POST", "/trips", input, options);
  }

  updateTrip(id: string, update: TripUpdate, options: RequestOptions = {}) {
    return this.request<void>("PATCH", `/trips/${id}`, update, options);
  }

  async alerts(filters: AlertFilters = {}, options: RequestOptions = {}) {
    const payload = await this.request<unknown>(
      "GET",
      `/alerts${queryString(filters)}`,
      undefined,
      options,
    );
    const result = this.parse(payload, "/alerts", parseAlerts);
    this.noteRejectedRows("/alerts", result.rejected);
    return { data: result.alerts };
  }

  ackAlert(id: string, options: RequestOptions = {}) {
    return this.request<void>("POST", `/alerts/${id}/ack`, undefined, options);
  }

  async alertRules(options: RequestOptions = {}) {
    const payload = await this.request<unknown>("GET", "/alert-rules", undefined, options);
    const result = this.parse(payload, "/alert-rules", parseAlertRules);
    this.noteRejectedRows("/alert-rules", result.rejected);
    return { data: result.rules };
  }

  updateAlertRule(
    id: string,
    update: { enabled?: boolean; config?: Record<string, unknown> },
    options: RequestOptions = {},
  ) {
    return this.request<void>("PATCH", `/alert-rules/${id}`, update, options);
  }

  async geofences(options: RequestOptions = {}) {
    const payload = await this.request<unknown>("GET", "/geofences", undefined, options);
    const result = this.parse(payload, "/geofences", parseGeofences);
    this.noteRejectedRows("/geofences", result.rejected);
    return { data: result.geofences };
  }

  createGeofence(input: GeofenceInput, options: RequestOptions = {}) {
    return this.request<{ id: string }>("POST", "/geofences", input, options);
  }

  updateGeofence(id: string, input: Partial<GeofenceInput>, options: RequestOptions = {}) {
    return this.request<void>("PATCH", `/geofences/${id}`, input, options);
  }

  deleteGeofence(id: string, options: RequestOptions = {}) {
    return this.request<void>("DELETE", `/geofences/${id}`, undefined, options);
  }

  drivers(options: RequestOptions = {}) {
    return this.request<{ data: Driver[] }>("GET", "/drivers", undefined, options);
  }

  createDriver(input: DriverInput, options: RequestOptions = {}) {
    return this.request<{ id: string }>("POST", "/drivers", input, options);
  }

  updateDriver(id: string, update: DriverUpdate, options: RequestOptions = {}) {
    return this.request<void>("PATCH", `/drivers/${id}`, update, options);
  }

  reportSummary(from: string, to: string, options: RequestOptions = {}) {
    return this.request<ReportSummary>(
      "GET",
      `/reports/summary${queryString({ from, to })}`,
      undefined,
      options,
    );
  }

  systemHealth(options: RequestOptions = {}): Promise<SystemHealth> {
    return this.validated(this.request<unknown>("GET", "/system/health", undefined, options), systemHealthSchema);
  }

  audit(filters: AuditFilters, options: RequestOptions = {}): Promise<AuditResponse> {
    return this.validated(
      this.request<unknown>("GET", `/audit${queryString(filters)}`, undefined, options),
      auditResponseSchema,
    );
  }

  importVehicles(file: File, options: RequestOptions = {}): Promise<ImportResult> {
    const form = new FormData();
    form.append("file", file);
    return this.validated(
      this.request<unknown>("POST", "/import/vehicles", form, {
        ...options,
        timeoutMs: options.timeoutMs ?? UPLOAD_TIMEOUT_MS,
      }),
      importResultSchema,
    );
  }

}

export type { AppError };
