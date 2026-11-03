import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "./ErrorState";
import type { AppError } from "./types";

function error(overrides: Partial<AppError> = {}): AppError {
  return {
    kind: "server",
    retryable: true,
    outcome: "failed",
    context: { route: "/alerts" },
    at: 0,
    ...overrides,
  };
}

describe("ErrorState", () => {
  it("shows the catalog copy and a working Retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={error()} onRetry={onRetry} />);

    expect(screen.getByText("Something went wrong on our side")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders a compact scope for a failed panel", () => {
    render(<ErrorState error={error()} compact onRetry={vi.fn()} />);
    expect(screen.getByText("Couldn't load")).toBeInTheDocument();
  });

  it("offers to copy diagnostics for contract failures", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ErrorState error={error({ kind: "contract" })} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    expect(writeText).toHaveBeenCalledOnce();
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("does not render a status code or the raw server message for a 5xx", () => {
    render(
      <ErrorState
        error={error({ status: 500, serverMessage: "panic: nil pointer" })}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByText(/panic/)).not.toBeInTheDocument();
    expect(screen.queryByText(/500/)).not.toBeInTheDocument();
  });
});
