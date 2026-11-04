import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error("render failed");
  return <p>recovered</p>;
}

describe("ErrorBoundary", () => {
  it("contains a panel crash and leaves the rest of the page working", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <div>
        <p>map still works</p>
        <ErrorBoundary level="panel">
          <Boom explode />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText("map still works")).toBeInTheDocument();
    expect(screen.getByText("This part of the page stopped working")).toBeInTheDocument();
  });

  it("resets when its reset keys change", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender } = render(
      <ErrorBoundary level="route" resetKeys={[0]}>
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <ErrorBoundary level="route" resetKeys={[1]}>
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("recovered")).toBeInTheDocument();
  });
});
