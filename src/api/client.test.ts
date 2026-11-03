import { afterEach, describe, expect, it, vi } from "vitest";
import { FleetApiClient } from "./client";
import type { AppError } from "../errors/types";

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

  it("does not emit session expiry for a rejected login", async () => {
    const onSessionExpired = vi.fn();
    const client = new FleetApiClient(
      "",
      fetcherOf(
        jsonResponse({ error: { code: "invalid_credentials", message: "invalid email or password" } }, 401),
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
        return Promise.resolve(jsonResponse({ error: { code: "csrf_failed", message: "csrf" } }, 403));
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
      return Promise.resolve(jsonResponse({ job_id: "j", total: 1, imported: 1, failed: 0, errors: [] }));
    }) as unknown as typeof fetch;
    const client = new FleetApiClient("", fetcher);
    await expect(
      client.importVehicles(new File(["imei\n1"], "vehicles.csv", { type: "text/csv" })),
    ).resolves.toMatchObject({ imported: 1 });
  });
});
