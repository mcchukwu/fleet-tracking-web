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
    expect(screen.getByText("The end time must be after the start time.")).toBeVisible();
    expect(onApply).not.toHaveBeenCalled();
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
    expect(screen.getByText("Choose a range of 7 days or less.")).toBeVisible();
  });
});
