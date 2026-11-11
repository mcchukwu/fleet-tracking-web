import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateRangeDialog } from "./DateRangeDialog";
import { validateDatetimeRange } from "../lib/datetime";

function localIso(y: number, m: number, d: number, h: number, min: number): string {
  return new Date(y, m - 1, d, h, min).toISOString();
}

const from = localIso(2026, 11, 8, 12, 0);
const to = localIso(2026, 11, 8, 14, 0);

describe("DateRangeDialog", () => {
  it("converts local fields to UTC and applies", async () => {
    const onApply = vi.fn();
    render(
      <DateRangeDialog
        open
        from={from}
        to={to}
        validate={validateDatetimeRange}
        onApply={onApply}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-11-08T14:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-11-08T16:00" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(
      localIso(2026, 11, 8, 14, 0),
      localIso(2026, 11, 8, 16, 0),
    );
  });

  it("rejects an end that is not after the start and focuses the start", async () => {
    const onApply = vi.fn();
    render(
      <DateRangeDialog
        open
        from={from}
        to={to}
        validate={validateDatetimeRange}
        onApply={onApply}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-11-08T11:00" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      screen.getAllByText("The end time must be after the start time.")[0],
    ).toBeVisible();
    const start = screen.getByLabelText("Start");
    const end = screen.getByLabelText("End");
    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(start).toHaveAttribute("aria-describedby");
    expect(start).toHaveFocus();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("attaches an empty-start error to the start field", async () => {
    render(
      <DateRangeDialog
        open
        from={from}
        to={to}
        validate={validateDatetimeRange}
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

  it("surfaces a caller-specific validation rule", async () => {
    render(
      <DateRangeDialog
        open
        from={from}
        to={to}
        validate={(startIso, endIso) => {
          const result = validateDatetimeRange(startIso, endIso);
          if (!result.valid) return result;
          if (result.toMs - result.fromMs > 7 * 86_400_000) {
            return {
              valid: false,
              reason: "too_long",
              message: "Choose a range of 7 days or less.",
              field: "both",
            };
          }
          return result;
        }}
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-11-01T00:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-11-09T00:00" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getAllByText("Choose a range of 7 days or less.")[0]).toBeVisible();
  });

  it("returns focus to the opener when cancelled", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open range
          </button>
          <DateRangeDialog
            open={open}
            from={from}
            to={to}
            validate={validateDatetimeRange}
            onApply={() => undefined}
            onClose={() => setOpen(false)}
          />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open range" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();
  });

  it("labels the dialog and explains that the request uses UTC", () => {
    render(
      <DateRangeDialog
        open
        from={from}
        to={to}
        title="Report range"
        validate={validateDatetimeRange}
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Report range" })).toBeVisible();
    expect(
      screen.getByText("Times are local; the request uses UTC."),
    ).toBeVisible();
  });
});
