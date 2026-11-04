import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import { ApiError, type AppError } from "../../../errors/types";
import { normalize } from "../../../errors/normalize";
import { useLogin } from "./useLogin";

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function setup() {
  const queryClient = new QueryClient();
  return renderHook(() => useLogin(), { wrapper: wrapperFor(queryClient) });
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLogin", () => {
  it("prevents a second submission while the first is pending", async () => {
    const request = deferred<{ user: typeof user; csrf_token: string }>();
    const login = vi.spyOn(api, "login").mockReturnValue(request.promise);
    const { result } = setup();

    let second: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      const first = result.current.submit(user.email, "secret");
      second = await result.current.submit(user.email, "secret");
      request.resolve({ user, csrf_token: "token" });
      await first;
    });

    expect(second?.status).toBe("busy");
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("normalises a 401 and asks the form to clear the password", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      normalize(new ApiError(401, "invalid_credentials", "invalid email or password")),
    );
    const { result } = setup();

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit(user.email, "wrong");
    });

    expect(outcome?.status).toBe("error");
    if (outcome?.status === "error") {
      expect(outcome.error.kind).toBe("unauthenticated");
      expect(outcome.clearPassword).toBe(true);
    }
    expect(result.current.error?.kind).toBe("unauthenticated");
  });

  it("keeps the password when the failure is not a credential error", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = setup();

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit(user.email, "secret");
    });

    expect(outcome?.status).toBe("error");
    if (outcome?.status === "error") {
      expect(outcome.error.kind).toBe("network");
      expect(outcome.clearPassword).toBe(false);
    }
  });

  it("preserves Retry-After on a rate limit", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      normalize(new ApiError(429, "rate_limited", "Too many attempts", 7)),
    );
    const { result } = setup();

    await act(async () => {
      await result.current.submit(user.email, "secret");
    });

    expect(result.current.error?.retryAfterSec).toBe(7);
  });

  it("aborts without reporting an error", async () => {
    vi.spyOn(api, "login").mockImplementation(
      (_email: string, _password: string, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const abort = () => reject(new DOMException("aborted", "AbortError"));
          if (options?.signal?.aborted) {
            abort();
            return;
          }
          options?.signal?.addEventListener("abort", abort);
        }),
    );
    const { result } = setup();

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      const pending = result.current.submit(user.email, "secret");
      result.current.cancel();
      outcome = await pending;
    });

    expect(outcome?.status).toBe("aborted");
    expect(result.current.error).toBeNull();
  });

  it("reports the 3s and 10s slow states", async () => {
    vi.useFakeTimers();
    const request = deferred<{ user: typeof user; csrf_token: string }>();
    vi.spyOn(api, "login").mockReturnValue(request.promise);
    const { result } = setup();

    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = result.current.submit(user.email, "secret");
    });
    await act(async () => { vi.advanceTimersByTime(3_000); });
    expect(result.current.slow).toBe("working");
    await act(async () => { vi.advanceTimersByTime(7_000); });
    expect(result.current.slow).toBe("long");

    await act(async () => {
      request.resolve({ user, csrf_token: "token" });
      await pending;
    });
    expect(result.current.slow).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("clears the error on reset", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = setup();

    await act(async () => {
      await result.current.submit(user.email, "secret");
    });
    const error: AppError | null = result.current.error;
    expect(error).not.toBeNull();

    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});
