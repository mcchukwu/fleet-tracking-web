import { render, screen } from "@testing-library/react";
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

  it("shows a retry action for a failed cell", async () => {
    const onRetry = vi.fn();
    render(
      <KpiStrip
        cells={[
          { label: "Online", value: "20 of 25" },
          { label: "Open alerts", value: "—", error: true, onRetry },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders loading placeholders instead of presenting zeroes as data", () => {
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
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
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
