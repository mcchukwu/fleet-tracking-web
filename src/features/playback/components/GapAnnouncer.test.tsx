import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GapAnnouncer } from "./GapAnnouncer";

const fromMs = Date.parse("2026-11-08T14:00:00Z");
const gap = { startIndex: 1, startMs: fromMs + 10 * 60_000, endMs: fromMs + 25 * 60_000 };

describe("GapAnnouncer", () => {
  it("announces only the first entry into a gap", () => {
    const { rerender } = render(<GapAnnouncer inGap={false} playheadMs={fromMs} gaps={[gap]} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();

    rerender(<GapAnnouncer inGap playheadMs={fromMs + 15 * 60_000} gaps={[gap]} />);
    expect(region).toHaveTextContent(/No data .* to .*/);

    rerender(<GapAnnouncer inGap playheadMs={fromMs + 16 * 60_000} gaps={[gap]} />);
    expect(region).toHaveTextContent(/No data .* to .*/);

    rerender(<GapAnnouncer inGap={false} playheadMs={fromMs + 30 * 60_000} gaps={[gap]} />);
    expect(region).toBeEmptyDOMElement();
  });
});
