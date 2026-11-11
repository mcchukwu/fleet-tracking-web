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

  it("renders a compact scope for a failed panel with the catalog title", () => {
    render(<ErrorState error={error()} compact onRetry={vi.fn()} />);
    expect(screen.getByText("Something went wrong on our side")).toBeInTheDocument();
    expect(screen.queryByText("Try again in a moment. If it keeps happening, check System.")).toBeNull();
  });

  it("replaces only the title when a caller needs different copy", () => {
    render(
      <ErrorState
        error={error({ kind: "network" })}
        titleOverride="Can't reach the API"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Can't reach the API")).toBeInTheDocument();
    expect(screen.queryByText("Can't reach the server")).not.toBeInTheDocument();
    expect(
      screen.getByText("Check your connection. Your data is safe."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps the override in the compact variant", () => {
    render(
      <ErrorState
        error={error()}
        compact
        titleOverride="Can't reach the API"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Can't reach the API")).toBeInTheDocument();
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
