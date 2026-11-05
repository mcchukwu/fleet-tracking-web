import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timestamp } from "./Timestamp";
import { TooltipProvider } from "./Tooltip";

describe("Timestamp", () => {
  it("shows a relative time with a machine-readable instant", () => {
    render(
      <TooltipProvider>
        <Timestamp iso="2026-11-04T09:58:00Z" now={Date.parse("2026-11-04T10:00:00Z")} />
      </TooltipProvider>,
    );
    const element = screen.getByText("2m ago");
    expect(element.tagName).toBe("TIME");
    expect(element).toHaveAttribute("datetime", "2026-11-04T09:58:00Z");
    expect(element.closest("button")).toBeInTheDocument();
  });

  it("falls back to the missing marker for an invalid timestamp", () => {
    render(
      <TooltipProvider>
        <Timestamp iso="not-a-date" now={Date.parse("2026-11-04T10:00:00Z")} />
      </TooltipProvider>,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
