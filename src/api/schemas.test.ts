import { describe, expect, it } from "vitest";
import {
  auditResponseSchema,
  liveMessageSchema,
  systemHealthSchema,
  importResultSchema,
} from "./schemas";
import { systemHealthFixture, auditResponseFixture, importResultFixture } from "../mocks/fixtures/untyped";
import { malformedLiveFrames, positionFrame, alertFrame } from "../mocks/fixtures/live";

describe("contract schemas", () => {
  it("accepts a real position frame", () => {
    const parsed = liveMessageSchema.safeParse(positionFrame);
    expect(parsed.success).toBe(true);
  });

  it("accepts a documented alert frame with unknown keys", () => {
    const parsed = liveMessageSchema.safeParse(alertFrame);
    expect(parsed.success).toBe(true);
  });

  it.each(malformedLiveFrames)("rejects a malformed live frame", (frame) => {
    expect(liveMessageSchema.safeParse(frame).success).toBe(false);
  });

  it("parses the observed system health payload", () => {
    const parsed = systemHealthSchema.safeParse(systemHealthFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ingest.received).toBe(72180);
      expect(parsed.data.dependencies.postgres).toBe(true);
    }
  });

  it("parses the observed audit payload", () => {
    const parsed = auditResponseSchema.safeParse(auditResponseFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data[0]?.action).toBe("auth.login");
    }
  });

  it("accepts both null and an array for import errors", () => {
    expect(importResultSchema.safeParse(importResultFixture).success).toBe(true);
    expect(
      importResultSchema.safeParse({ ...importResultFixture, errors: null }).success,
    ).toBe(true);
  });
});
