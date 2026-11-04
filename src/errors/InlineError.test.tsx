import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InlineError } from "./InlineError";
import type { AppError } from "./types";

const error: AppError = {
  kind: "validation",
  retryable: false,
  outcome: "failed",
  serverMessage: "Plate is already registered",
  code: "invalid_input",
  context: { route: "/vehicles" },
  at: 0,
};

describe("InlineError", () => {
  it("announces the error and links to its field", () => {
    render(<InlineError id="plate-error" error={error} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("id", "plate-error");
    expect(alert).toHaveTextContent("Plate is already registered");
  });

  it("can hide the title for a field-level message", () => {
    render(<InlineError id="plate-error" error={error} showTitle={false} />);
    expect(screen.queryByText("Check the highlighted fields")).not.toBeInTheDocument();
    expect(screen.getByText("Plate is already registered")).toBeInTheDocument();
  });

  it("shows Retry when the caller provides one", async () => {
    const onRetry = vi.fn();
    render(<InlineError error={{ ...error, kind: "network" }} onRetry={onRetry} />);
    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses a surface-specific copy override and omits an empty detail", () => {
    render(
      <InlineError
        error={{ ...error, kind: "unauthenticated" }}
        copy={{ title: "Email or password is incorrect.", detail: "" }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Your session expired");
  });

  it("offers Copy diagnostics for server errors", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<InlineError error={{ ...error, kind: "server" }} />);
    screen.getByRole("button", { name: "Copy diagnostics" }).click();

    expect(writeText).toHaveBeenCalledOnce();
    expect(await screen.findByText("Copied")).toBeVisible();
  });
});
