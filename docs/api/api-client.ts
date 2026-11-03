import type {
  Alert,
  AlertRule,
  Driver,
  DriverInput,
  DriverUpdate,
  ErrorResponse,
  Geofence,
  GeofenceInput,
  ImportResult,
  LiveMessage,
  LoginResponse,
  Point,
  ReportSummary,
  Trip,
  TripInput,
  TripUpdate,
  User,
  Vehicle,
  VehicleEvent,
  VehicleUpdate,
} from "./api-types";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class FleetApi {
  private csrfToken = "";
  private readonly fetcher: typeof fetch;

  constructor(
    private readonly baseUrl = "",
    fetcher: typeof fetch = fetch,
  ) {
    this.fetcher = fetcher;
  }

  private url(path: string): string {
    return `${this.baseUrl}/api/v1${path}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const response = await this.fetcher(this.url(path), {
      method,
      credentials: "include",
      headers: {
        ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(method !== "GET" && this.csrfToken ? { "X-CSRF-Token": this.csrfToken } : {}),
        ...headers,
      },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : undefined;

    if (!response.ok) {
      const error = payload as ErrorResponse | undefined;
      throw new ApiError(
        response.status,
        error?.error?.code ?? "request_failed",
        error?.error?.message ?? response.statusText,
      );
    }
    return payload as T;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const result = await this.request<LoginResponse>("POST", "/auth/login", { email, password });
    this.csrfToken = result.csrf_token;
    this.user = result.user;
    return result;
  }

  async logout(): Promise<void> {
    await this.request<void>("POST", "/auth/logout");
    this.csrfToken = "";
  }

  async me(): Promise<LoginResponse> {
    const result = await this.request<LoginResponse>("GET", "/me");
    this.csrfToken = result.csrf_token;
    this.user = result.user;
    return result;
  }

  vehicles(query: { q?: string; status?: string; limit?: number; offset?: number } = {}) {
    return this.request<{ data: Vehicle[] }>("GET", `/vehicles${queryString(query)}`);
  }

  vehicle(id: string) {
    return this.request<{ data: Vehicle }>("GET", `/vehicles/${id}`);
  }

  updateVehicle(id: string, update: VehicleUpdate) {
    return this.request<void>("PATCH", `/vehicles/${id}`, update);
  }

  history(id: string, from?: string, to?: string, resolution?: "raw" | "30s" | "5m") {
    return this.request<{ data: Point[]; resolution: string }>(
      "GET",
      `/vehicles/${id}/history${queryString({ from, to, resolution })}`,
    );
  }

  events(id: string, from?: string, to?: string) {
    return this.request<{ data: VehicleEvent[] }>(
      "GET",
      `/vehicles/${id}/events${queryString({ from, to })}`,
    );
  }

  liveSnapshot() {
    return this.request<{ data: Vehicle[] }>("GET", "/live/snapshot");
  }

  trips(status?: string) {
    return this.request<{ data: Trip[] }>("GET", `/trips${queryString({ status })}`);
  }

  createTrip(input: TripInput) {
    return this.request<{ id: string }>("POST", "/trips", input);
  }

  updateTrip(id: string, update: TripUpdate) {
    return this.request<void>("PATCH", `/trips/${id}`, update);
  }

  alerts(query: { status?: string; type?: string; limit?: number; offset?: number } = {}) {
    return this.request<{ data: Alert[] }>("GET", `/alerts${queryString(query)}`);
  }

  ackAlert(id: string) {
    return this.request<void>("POST", `/alerts/${id}/ack`);
  }

  alertRules() {
    return this.request<{ data: AlertRule[] }>("GET", "/alert-rules");
  }

  updateAlertRule(id: string, update: { enabled?: boolean; config?: Record<string, unknown> }) {
    return this.request<void>("PATCH", `/alert-rules/${id}`, update);
  }

  geofences() {
    return this.request<{ data: Geofence[] }>("GET", "/geofences");
  }

  createGeofence(input: GeofenceInput) {
    return this.request<{ id: string }>("POST", "/geofences", input);
  }

  updateGeofence(id: string, input: Partial<GeofenceInput>) {
    return this.request<void>("PATCH", `/geofences/${id}`, input);
  }

  deleteGeofence(id: string) {
    return this.request<void>("DELETE", `/geofences/${id}`);
  }

  drivers() {
    return this.request<{ data: Driver[] }>("GET", "/drivers");
  }

  createDriver(input: DriverInput) {
    return this.request<{ id: string }>("POST", "/drivers", input);
  }

  updateDriver(id: string, update: DriverUpdate) {
    return this.request<void>("PATCH", `/drivers/${id}`, update);
  }

  reportSummary(from?: string, to?: string) {
    return this.request<ReportSummary>("GET", `/reports/summary${queryString({ from, to })}`);
  }

  systemHealth() {
    return this.request<Record<string, unknown>>("GET", "/system/health");
  }

  currentUser(): User | undefined {
    return this.user;
  }

  private user?: User;

  async importVehicles(file: File): Promise<ImportResult> {
    const form = new FormData();
    form.append("file", file);
    return this.request<ImportResult>("POST", "/import/vehicles", form);
  }

  connectLive(onMessage: (message: LiveMessage) => void): WebSocket {
    const base = this.baseUrl || window.location.origin;
    const socket = new WebSocket(`${base.replace(/^http/, "ws")}/api/v1/live/ws`);
    socket.addEventListener("message", (event) => {
      try {
        onMessage(JSON.parse(event.data) as LiveMessage);
      } catch {
        // Ignore a malformed frame rather than tearing down the socket.
      }
    });
    return socket;
  }
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "" && value !== null) {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
