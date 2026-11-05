import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KpiStrip } from "./KpiStrip";

describe("KpiStrip", () => {
  it("renders four clickable cells with dividers between them", async () => {
    const onOnline = vi.fn();
    const { container } = render(
      <KpiStrip
        cells={[
          { label: "Online", value: "20 of 25", onClick: onOnline },
          { label: "Active trips", value: "4" },
          { label: "Open alerts", value: "5" },
          { label: "Last data", value: "4s" },
        ]}
      />,
    );

    expect(screen.getByText("20 of 25")).toBeInTheDocument();
    expect(screen.getByText("4s")).toBeInTheDocument();
    const cells = container.firstElementChild?.children;
    expect(cells?.[1]).toHaveClass("border-l");
    await userEvent.click(screen.getByRole("button", { name: /Online/ }));
    expect(onOnline).toHaveBeenCalledOnce();
  });

  it("names the retry action for its cell and only spins the failing cell", async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <KpiStrip
        cells={[
          { label: "Online", value: "20 of 25", error: true, onRetry: vi.fn() },
          { label: "Open alerts", value: "—", error: true, retrying: true, onRetry },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Retry Open alerts" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Retry Online" })).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-spin")).toHaveLength(1);
  });

  it("shows loading placeholders only after the 200ms delay", async () => {
    const { container } = render(
      <KpiStrip
        loading
        cells={[
          { label: "Online", value: "0 of 0" },
          { label: "Active trips", value: "0" },
          { label: "Open alerts", value: "—" },
          { label: "Last data", value: "—" },
        ]}
      />,
    );
    expect(screen.queryByText("0 of 0")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll(".animate-pulse-soft")).toHaveLength(0);

    await waitFor(
      () => expect(container.querySelectorAll(".animate-pulse-soft")).toHaveLength(4),
      { timeout: 1_000 },
    );
  });

  it("renders a compact grid without borders between cells", () => {
    const { container } = render(
      <KpiStrip
        compact
        cells={[
          { label: "Online", value: "20 of 25" },
          { label: "Active trips", value: "4" },
        ]}
      />,
    );
    expect(container.firstElementChild).toHaveClass("grid-cols-2");
  });
});
