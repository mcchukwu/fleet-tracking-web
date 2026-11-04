import { delay, HttpResponse, type HttpHandler } from "msw";

export type FaultKind =
  | "offline"
  | "network"
  | "timeout"
  | "unauthenticated"
  | "csrf"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "server"
  | "unavailable"
  | "contract"
  | "slow"
  | "malformed"
  | "unknown_enum"
  | "lost";

const faultKinds = new Set<string>([
  "offline",
  "network",
  "timeout",
  "unauthenticated",
  "csrf",
  "forbidden",
  "not_found",
  "conflict",
  "validation",
  "rate_limited",
  "server",
  "unavailable",
  "contract",
  "slow",
  "malformed",
  "unknown_enum",
  "lost",
]);

export function isFaultKind(value: string): value is FaultKind {
  return faultKinds.has(value);
}

export function faultResponse(kind: FaultKind, retryAfterSec = 30): Promise<Response> {
  switch (kind) {
    case "offline":
    case "network":
      return Promise.resolve(HttpResponse.error());
    case "timeout":
      return new Promise<Response>(() => undefined);
    case "unauthenticated":
      return Promise.resolve(
        HttpResponse.json(
          { error: { code: "unauthenticated", message: "session expired" } },
          { status: 401 },
        ),
      );
    case "csrf":
      return Promise.resolve(
        HttpResponse.json(
          { error: { code: "csrf_failed", message: "csrf validation failed" } },
          { status: 403 },
        ),
      );
    case "forbidden":
      return Promise.resolve(
        HttpResponse.json(
          { error: { code: "forbidden", message: "forbidden" } },
          { status: 403 },
        ),
      );
    case "not_found":
      return Promise.resolve(
        HttpResponse.json({ error: { code: "not_found", message: "not found" } }, { status: 404 }),
      );
    case "conflict":
      return Promise.resolve(
        HttpResponse.json(
          { error: { code: "conflict", message: "The record changed elsewhere." } },
          { status: 409 },
        ),
      );
    case "validation":
      return Promise.resolve(
        HttpResponse.json(
          { error: { code: "invalid_input", message: "Check the fields." } },
          { status: 400 },
        ),
      );
    case "rate_limited":
      return Promise.resolve(
        HttpResponse.json(
          { error: { code: "rate_limited", message: "Too many attempts." } },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfterSec) },
          },
        ),
      );
    case "server":
      return Promise.resolve(
        HttpResponse.json(
          { error: { code: "internal", message: "Something broke." } },
          { status: 500 },
        ),
      );
    case "unavailable":
      return Promise.resolve(
        HttpResponse.json(
          { error: { code: "unavailable", message: "Temporarily unavailable." } },
          { status: 503 },
        ),
      );
    case "contract":
      return Promise.resolve(HttpResponse.json({ data: [{ unexpected: true }] }));
    case "malformed":
      return Promise.resolve(malformed());
    case "unknown_enum":
      return Promise.resolve(unknownEnum());
    case "lost":
      return lostResponse();
    case "slow":
      return delay(12_000).then(() => HttpResponse.json({ data: [] }));
  }
}

export function slow(ms: number): Promise<void> {
  return delay(ms).then(() => undefined);
}

export function malformed(): Response {
  return HttpResponse.json({ data: [{ unexpected: true }] });
}

export function unknownEnum(): Response {
  return HttpResponse.json({
    data: [
      {
        id: "unknown-alert",
        vehicle_id: "unknown",
        plate: "UNKNOWN",
        type: "solar_flare",
        severity: "critical",
        status: "open",
        occurred_at: "2026-11-03T08:00:00Z",
        evidence: {},
      },
    ],
  });
}

export function lostResponse(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

export function withFault(
  resource: string,
  request: Request,
  resolver: () => Response | Promise<Response>,
): Response | Promise<Response> {
  const fault = new URL(request.url).searchParams.get("fault");
  if (!fault) return resolver();
  const [target, kind] = fault.split(":");
  if (target !== resource || !kind || !isFaultKind(kind)) return resolver();
  return faultResponse(kind);
}

export type { HttpHandler };
