import { beforeEach, describe, expect, it } from "vitest";
import {
  isErrorStorm,
  recordRequestFailure,
  recordRequestSuccess,
  resetErrorStorm,
} from "./global";

describe("error storm control", () => {
  beforeEach(() => {
    resetErrorStorm();
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
});
