import { describe, expect, it } from "vitest";
import type { AppError } from "../../../errors/types";
import { importFailureCopy, previewIssueCopy, resultSentence } from "./copy";

function error(overrides: Partial<AppError>): AppError {
  return {
    kind: "network",
    retryable: true,
    outcome: "failed",
    context: { route: "/import" },
    at: 0,
    ...overrides,
  };
}

describe("import copy", () => {
  it("explains every blocking preview issue", () => {
    expect(previewIssueCopy("wrong-type").title).toBe("Choose a .csv file.");
    expect(previewIssueCopy("empty-file").title).toBe("This file is empty.");
    expect(previewIssueCopy("no-data-rows").title).toBe("This file has no data rows.");
    expect(previewIssueCopy("missing-imei").title).toBe(
      "This file has no imei column.",
    );
    expect(previewIssueCopy("unreadable").title).toBe("Couldn't read this file.");
    for (const issue of [
      "wrong-type",
      "empty-file",
      "no-data-rows",
      "missing-imei",
      "unreadable",
    ] as const) {
      expect(previewIssueCopy(issue).detail.length).toBeGreaterThan(0);
    }
  });

  it("summarises clean, partial and zero imports", () => {
    expect(resultSentence({ total: 2, imported: 2, failed: 0 })).toBe(
      "2 vehicles imported.",
    );
    expect(resultSentence({ total: 1, imported: 1, failed: 0 })).toBe(
      "1 vehicle imported.",
    );
    expect(resultSentence({ total: 12, imported: 10, failed: 2 })).toBe(
      "10 vehicles imported, 2 rows failed.",
    );
    expect(resultSentence({ total: 3, imported: 0, failed: 3 })).toBe(
      "No vehicles imported. 3 rows failed.",
    );
    expect(resultSentence({ total: 0, imported: 0, failed: 0 })).toBe(
      "No rows to import.",
    );
  });

  it("uses the allowlisted invalid_csv server message", () => {
    const copy = importFailureCopy(
      error({
        kind: "validation",
        status: 400,
        code: "invalid_csv",
        serverMessage: "the header must include imei",
      }),
    );
    expect(copy.title).toBe("Couldn't read this file");
    expect(copy.detail).toBe("the header must include imei");
  });

  it("keeps the file for a generic invalid request", () => {
    const copy = importFailureCopy(
      error({
        kind: "validation",
        status: 400,
        code: "invalid_request",
        serverMessage: "expected a multipart file field named file",
      }),
    );
    expect(copy.title).toBe("Couldn't import this file");
    expect(copy.detail).toContain("still selected");
    expect(copy.detail).not.toContain("multipart");
  });

  it("treats an uncertain outcome as safe to upload again", () => {
    for (const kind of ["network", "timeout"] as const) {
      const copy = importFailureCopy(
        error({ kind, outcome: "unknown", retryable: true }),
      );
      expect(copy.title).toBe("We couldn't confirm the import");
      expect(copy.detail).toBe("It's safe to upload again.");
    }
  });

  it("explains role and session failures", () => {
    expect(importFailureCopy(error({ kind: "forbidden", status: 403 })).title).toBe(
      "Your role can't import vehicles.",
    );
    expect(
      importFailureCopy(error({ kind: "unauthenticated", status: 401 })).title,
    ).toBe("Your session expired.");
  });

  it("falls back to catalog copy without raw server text", () => {
    const server = importFailureCopy(
      error({
        kind: "server",
        status: 500,
        serverMessage: "panic: nil pointer",
      }),
    );
    expect(server.title).toBe("Something went wrong on our side");
    expect(server.detail).not.toContain("panic");

    const contract = importFailureCopy(
      error({ kind: "contract", retryable: true }),
    );
    expect(contract.title).toBe("Unexpected response from the server");
  });

  it("never treats a cancelled upload as an error", () => {
    expect(importFailureCopy(error({ kind: "aborted" })).title).toBe(
      "Upload cancelled",
    );
  });
});
