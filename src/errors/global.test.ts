import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getErrorStorm,
  handleGlobalError,
  isErrorStorm,
  recordRequestFailure,
  recordRequestSuccess,
  resetErrorStorm,
  retryDelay,
  subscribeErrorStorm,
} from "./global";
import { clearDiagnostics } from "./report";
import { normalize } from "./normalize";
import { ApiError } from "./types";

describe("error storm control", () => {
  beforeEach(() => {
    resetErrorStorm();
    clearDiagnostics();
  });

  it("triggers after three distinct resources fail within thirty seconds", () => {
    recordRequestFailure("alerts", "server", 1_000);
    recordRequestFailure("vehicles", "network", 2_000);
    expect(isErrorStorm(3_000)).toBe(false);
    recordRequestFailure("trips", "unavailable", 3_000);
    expect(isErrorStorm(4_000)).toBe(true);
  });

  it("does not count the same resource three times", () => {
    recordRequestFailure("alerts", "server", 1_000);
    recordRequestFailure("alerts", "server", 2_000);
    recordRequestFailure("alerts", "server", 3_000);
    expect(isErrorStorm(4_000)).toBe(false);
  });

  it("ignores failures outside the window", () => {
    recordRequestFailure("alerts", "server", 1_000);
    recordRequestFailure("vehicles", "network", 2_000);
    recordRequestFailure("trips", "unavailable", 40_000);
    expect(isErrorStorm(41_000)).toBe(false);
  });

  it("does not count non-infrastructure kinds", () => {
    recordRequestFailure("alerts", "forbidden", 1_000);
    recordRequestFailure("vehicles", "not_found", 2_000);
    recordRequestFailure("trips", "validation", 3_000);
    expect(isErrorStorm(4_000)).toBe(false);
  });

  it("clears after any successful request", () => {
    recordRequestFailure("alerts", "server", 1_000);
    recordRequestFailure("vehicles", "network", 2_000);
    recordRequestFailure("trips", "unavailable", 3_000);
    expect(isErrorStorm(4_000)).toBe(true);
    recordRequestSuccess();
    expect(isErrorStorm(5_000)).toBe(false);
  });

  it("notifies subscribers when the storm starts and clears", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeErrorStorm(listener);

    recordRequestFailure("alerts", "server");
    recordRequestFailure("vehicles", "network");
    expect(listener).not.toHaveBeenCalled();
    expect(getErrorStorm()).toBe(false);

    recordRequestFailure("trips", "unavailable");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getErrorStorm()).toBe(true);

    recordRequestSuccess();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getErrorStorm()).toBe(false);

    unsubscribe();
    recordRequestFailure("drivers", "server");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("announces an error once per dedupe window", () => {
    const announced = vi.fn();
    window.addEventListener("fleet:error-announced", announced);

    handleGlobalError(new TypeError("Failed to fetch"), { scope: "screen", resource: "alerts" });
    handleGlobalError(new TypeError("Failed to fetch"), { scope: "screen", resource: "alerts" });

    expect(announced).toHaveBeenCalledTimes(1);
    window.removeEventListener("fleet:error-announced", announced);
  });
});

describe("retry delay", () => {
  const network = normalize(new TypeError("Failed to fetch"), {}, { offline: false });

  it("doubles from about one second with jitter", () => {
    expect(retryDelay(1, network, () => 0)).toBe(1_000);
    expect(retryDelay(2, network, () => 0)).toBe(3_000);
    expect(retryDelay(1, network, () => 1)).toBe(1_400);
    expect(retryDelay(9, network, () => 0)).toBe(10_000);
  });

  it("honours Retry-After exactly", () => {
    const limited = normalize(new ApiError(429, "rate_limited", "slow down", 12));
    expect(retryDelay(1, limited, () => 1)).toBe(12_000);
  });
});
