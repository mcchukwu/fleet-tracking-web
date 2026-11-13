import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppError } from "../../../errors/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { ImportFailureNotice } from "./ImportFailureNotice";

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

function view(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("ImportFailureNotice", () => {
  it("offers another file for an invalid CSV", async () => {
    const onChooseAnother = vi.fn();
    view(
      <ImportFailureNotice
        error={error({
          kind: "validation",
          status: 400,
          code: "invalid_csv",
          serverMessage: "the header must include imei",
        })}
        fileName="vehicles.csv"
        onRetry={vi.fn()}
        onChooseAnother={onChooseAnother}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Couldn't read this file")).toBeInTheDocument();
    expect(screen.getByText("the header must include imei")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Choose another file" }));
    expect(onChooseAnother).toHaveBeenCalledTimes(1);
  });

  it("offers upload again after an uncertain network outcome", async () => {
    const onRetry = vi.fn();
    view(
      <ImportFailureNotice
        error={error({ kind: "network", outcome: "unknown" })}
        fileName="vehicles.csv"
        onRetry={onRetry}
        onChooseAnother={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("We couldn't confirm the import")).toBeInTheDocument();
    expect(screen.getByText("It's safe to upload again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Upload again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers a retry for a server failure without raw text", () => {
    view(
      <ImportFailureNotice
        error={error({
          kind: "server",
          status: 500,
          serverMessage: "panic: nil pointer",
        })}
        fileName="vehicles.csv"
        onRetry={vi.fn()}
        onChooseAnother={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("panic: nil pointer")).not.toBeInTheDocument();
  });

  it("counts down before a rate-limited upload can retry", () => {
    vi.useFakeTimers();
    try {
      view(
        <ImportFailureNotice
          error={error({
            kind: "rate_limited",
            status: 429,
            retryAfterSec: 30,
            at: Date.now(),
          })}
          fileName="vehicles.csv"
          onRetry={vi.fn()}
          onChooseAnother={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "Retry" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(screen.getByText("Try again in 30s.")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(31_000);
      });

      expect(screen.getByRole("button", { name: "Retry" })).not.toHaveAttribute("aria-disabled");
      expect(screen.getByText("You can try again now.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers a way back for a forbidden role", async () => {
    const onBack = vi.fn();
    view(
      <ImportFailureNotice
        error={error({ kind: "forbidden", status: 403 })}
        fileName="vehicles.csv"
        onRetry={vi.fn()}
        onChooseAnother={vi.fn()}
        onBack={onBack}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Back to the map" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("keeps the file after a session expiry without inventing a retry", () => {
    view(
      <ImportFailureNotice
        error={error({ kind: "unauthenticated", status: 401 })}
        fileName="vehicles.csv"
        onRetry={vi.fn()}
        onChooseAnother={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("Your session expired.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
