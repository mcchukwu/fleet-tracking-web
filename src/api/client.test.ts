import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FleetApiClient } from "./client";
import type { AppError } from "../errors/types";

const connectivity = vi.hoisted(() => ({
  reachable: vi.fn(),
  unreachable: vi.fn(),
}));

vi.mock("../stores/connection", () => ({
  reportFetchReachable: connectivity.reachable,
  reportFetchUnreachable: connectivity.unreachable,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetcherOf(response: Response | (() => Promise<Response>)): typeof fetch {
  return vi.fn(() =>
    typeof response === "function" ? response() : Promise.resolve(response),
  ) as unknown as typeof fetch;
}

async function caught(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (cause) {
    return cause as AppError;
  }
  throw new Error("Expected the request to reject");
}

afterEach(() => {
  vi.useRealTimers();
  onlineManager.setOnline(true);
  connectivity.reachable.mockReset();
  connectivity.unreachable.mockReset();
});

describe("api client", () => {
  it("returns undefined for 204", async () => {
    const client = new FleetApiClient("", fetcherOf(new Response(null, { status: 204 })));
    await expect(client.updateVehicle("id", { plate: "X" })).resolves.toBeUndefined();
  });

  it("normalizes a JSON server error", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(jsonResponse({ error: { code: "internal", message: "boom" } }, 500)),
    );
    const error = await caught(client.vehicles());
    expect(error.kind).toBe("server");
    expect(error.status).toBe(500);
    expect(error.serverMessage).toBe("boom");
  });

  it("normalizes a network failure", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    expect((await caught(client.vehicles())).kind).toBe("network");
  });

  it("times out after the configured deadline", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    const request = caught(client.vehicles({}, { timeoutMs: 50 }));
    await vi.advanceTimersByTimeAsync(60);
    expect((await request).kind).toBe("timeout");
  });

  it("keeps a caller abort quiet", async () => {
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    const controller = new AbortController();
    const request = caught(client.vehicles({}, { signal: controller.signal }));
    controller.abort();
    expect((await request).kind).toBe("aborted");
  });

  it("turns a malformed alert body into a contract error instead of a cast", async () => {
    const client = new FleetApiClient("", fetcherOf(jsonResponse({ data: [{ nope: true }] })));
    expect((await caught(client.alerts())).kind).toBe("contract");
  });

  it("does not emit session expiry for a rejected login", async () => {
    const onSessionExpired = vi.fn();
    const client = new FleetApiClient(
      "",
      fetcherOf(
        jsonResponse(
          { error: { code: "invalid_credentials", message: "invalid email or password" } },
          401,
        ),
      ),
    );
    client.setSessionHandlers({ onSessionExpired });
    const error = await caught(client.login("dispatcher@demo.ftb", "wrong"));
    expect(error.kind).toBe("unauthenticated");
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("emits session expiry on 401", async () => {
    const onSessionExpired = vi.fn();
    const client = new FleetApiClient(
      "",
      fetcherOf(jsonResponse({ error: { code: "unauthenticated", message: "no session" } }, 401)),
    );
    client.setSessionHandlers({ onSessionExpired });
    expect((await caught(client.vehicles())).kind).toBe("unauthenticated");
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("rejects an offline write before it reaches fetch", async () => {
    onlineManager.setOnline(false);
    const fetcher = vi.fn();
    const client = new FleetApiClient("", fetcher as unknown as typeof fetch);

    const error = await caught(client.updateVehicle("id", { plate: "X" }));

    expect(error.kind).toBe("offline");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports a transport failure as unreachable", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await caught(client.vehicles());
    expect(connectivity.unreachable).toHaveBeenCalledTimes(1);
  });

  it("reports any HTTP response as reachable", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(jsonResponse({ error: { code: "forbidden", message: "no" } }, 403)),
    );
    await caught(client.vehicles());
    expect(connectivity.reachable).toHaveBeenCalledTimes(1);
  });

  it("does not treat a timeout as unreachable", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    const request = caught(client.vehicles({}, { timeoutMs: 50 }));
    await vi.advanceTimersByTimeAsync(60);
    await request;
    expect(connectivity.unreachable).not.toHaveBeenCalled();
  });

  it("marks a rejected write as failed, not uncertain", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(jsonResponse({ error: { code: "invalid_input", message: "bad plate" } }, 400)),
    );
    const error = await caught(client.updateVehicle("id", { plate: "" }));
    expect(error.kind).toBe("validation");
    expect(error.outcome).toBe("failed");
  });

  it("marks a write that never reached the server as uncertain", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    const error = await caught(client.updateVehicle("id", { plate: "X" }));
    expect(error.kind).toBe("network");
    expect(error.outcome).toBe("unknown");
  });

  it("refreshes CSRF once and replays the write", async () => {
    const calls: Array<{ url: string; csrf: string | null }> = [];
    let attempt = 0;
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      attempt += 1;
      const headers = new Headers(init?.headers);
      calls.push({
        url: input instanceof Request ? input.url : String(input),
        csrf: headers.get("X-CSRF-Token"),
      });
      if (attempt === 1) {
        return Promise.resolve(
          jsonResponse({ error: { code: "csrf_failed", message: "csrf" } }, 403),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    client.setCsrfToken("old");
    const refreshCsrf = vi.fn(() => Promise.resolve("new"));
    client.setSessionHandlers({ refreshCsrf });

    await expect(client.updateVehicle("id", { plate: "X" })).resolves.toBeUndefined();
    expect(refreshCsrf).toHaveBeenCalledTimes(1);
    expect(calls.map((call) => call.csrf)).toEqual(["old", "new"]);
  });

  it("treats a second CSRF failure as forbidden", async () => {
    const fetcher = fetcherOf(() =>
      Promise.resolve(jsonResponse({ error: { code: "csrf_failed", message: "csrf" } }, 403)),
    );
    const client = new FleetApiClient("", fetcher);
    client.setCsrfToken("old");
    client.setSessionHandlers({ refreshCsrf: () => Promise.resolve("new") });
    expect((await caught(client.updateVehicle("id", { plate: "X" }))).kind).toBe("forbidden");
  });

  it("does not force a JSON content type for uploads", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBeNull();
      return Promise.resolve(
        jsonResponse({ job_id: "j", total: 1, imported: 1, failed: 0, errors: [] }),
      );
    }) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    await expect(
      client.importVehicles(new File(["imei\n1"], "vehicles.csv", { type: "text/csv" })),
    ).resolves.toMatchObject({ imported: 1 });
  });

  it("accepts a clean import response with null errors", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(jsonResponse({ job_id: "j", total: 2, imported: 2, failed: 0, errors: null })),
    );
    await expect(
      client.importVehicles(new File(["imei\n1\n2"], "vehicles.csv", { type: "text/csv" })),
    ).resolves.toMatchObject({ failed: 0, errors: null });
  });

  it("marks an unanswered upload as an unknown outcome", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    const request = caught(
      client.importVehicles(new File(["imei\n1"], "vehicles.csv", { type: "text/csv" }), {
        timeoutMs: 50,
      }),
    );
    await vi.advanceTimersByTimeAsync(60);
    const error = await request;
    expect(error.kind).toBe("timeout");
    expect(error.outcome).toBe("unknown");
  });

  it("parses alert rules and drops malformed rows", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(
        jsonResponse({
          data: [
            { id: "rule-1", type: "idle", enabled: true, config: null },
            { id: "bad", type: "idle", enabled: "yes" },
          ],
        }),
      ),
    );
    const response = await client.alertRules();
    expect(response.data).toEqual([{ id: "rule-1", type: "idle", enabled: true, config: {} }]);
  });

  it("normalises a null history page to an empty array", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(jsonResponse({ data: null, resolution: "30s" })),
    );
    await expect(client.history("v", { from: "a", to: "b" })).resolves.toEqual({
      data: [],
      resolution: "30s",
    });
  });

  it("turns a malformed history body into a contract error", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(jsonResponse({ data: [{ lat: "x" }], resolution: "30s" })),
    );
    expect((await caught(client.history("v"))).kind).toBe("contract");
  });
});

describe("report summary", () => {
  const summary = {
    active_trips: 4,
    alerts: 66,
    alerts_by_type: [{ key: "speeding", count: 4 }],
    completed_trips: 1,
    distance_km: 10917.07,
    open_alerts: 45,
    trips: 5,
    vehicles: 25,
  };

  it("sends both ends exactly and validates the response", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(jsonResponse({ ...summary, from: "a", to: "b" })),
    ) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    const result = await client.reportSummary("2026-11-08T10:00:00Z", "2026-11-08T12:00:00Z");
    expect(result.trips).toBe(5);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/reports/summary?from=2026-11-08T10%3A00%3A00Z&to=2026-11-08T12%3A00%3A00Z",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("turns a malformed core number into a contract error", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(jsonResponse({ ...summary, distance_km: null })),
    );
    expect((await caught(client.reportSummary("a", "b"))).kind).toBe("contract");
  });

  it("keeps the summary when one chart row is malformed", async () => {
    const client = new FleetApiClient(
      "",
      fetcherOf(
        jsonResponse({
          ...summary,
          alerts_by_type: [
            { key: "speeding", count: 4 },
            { key: null, count: "many" },
          ],
        }),
      ),
    );
    const result = await client.reportSummary("a", "b");
    expect(result.alerts_by_type).toEqual([{ key: "speeding", count: 4 }]);
  });

  it("honours a caller abort", async () => {
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    const controller = new AbortController();
    const request = caught(client.reportSummary("a", "b", { signal: controller.signal }));
    controller.abort();
    expect((await request).kind).toBe("aborted");
  });
});
