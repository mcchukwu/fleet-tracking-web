import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CustomRangeDialog } from "./CustomRangeDialog";

function localIso(y: number, m: number, d: number, h: number, min: number): string {
  return new Date(y, m - 1, d, h, min).toISOString();
}

describe("CustomRangeDialog", () => {
  it("converts local fields to UTC and applies", async () => {
    const onApply = vi.fn();
    render(
      <CustomRangeDialog
        open
        from={localIso(2026, 11, 8, 12, 0)}
        to={localIso(2026, 11, 8, 14, 0)}
        onApply={onApply}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-11-08T14:00" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2026-11-08T16:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(
      localIso(2026, 11, 8, 14, 0),
      localIso(2026, 11, 8, 16, 0),
    );
  });

  it("rejects an end that is not after the start", async () => {
    const onApply = vi.fn();
    render(
      <CustomRangeDialog
        open
        from={localIso(2026, 11, 8, 12, 0)}
        to={localIso(2026, 11, 8, 14, 0)}
        onApply={onApply}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2026-11-08T11:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      screen.getAllByText("The end time must be after the start time.")[0],
    ).toBeVisible();
    const start = screen.getByLabelText("Start");
    const end = screen.getByLabelText("End");
    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(start).toHaveAttribute("aria-describedby");
    expect(end).toHaveAttribute("aria-describedby");
    expect(start).toHaveFocus();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("attaches an empty-start error to the start field", async () => {
    render(
      <CustomRangeDialog
        open
        from={localIso(2026, 11, 8, 12, 0)}
        to={localIso(2026, 11, 8, 14, 0)}
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    const start = screen.getByLabelText("Start");
    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(start).toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText("End")).not.toHaveAttribute("aria-invalid");
    expect(start).toHaveFocus();
  });

  it("rejects a range over seven days", async () => {
    render(
      <CustomRangeDialog
        open
        from={localIso(2026, 11, 1, 0, 0)}
        to={localIso(2026, 11, 2, 0, 0)}
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-11-01T00:00" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2026-11-09T00:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getAllByText("Choose a range of 7 days or less.")[0]).toBeVisible();
  });
});
