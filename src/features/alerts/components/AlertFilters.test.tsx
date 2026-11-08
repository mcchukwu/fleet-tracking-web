import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { emptyAlertFilters } from "../lib/filter";
import { AlertFilters } from "./AlertFilters";

const typeOptions = [
  { value: "idle", label: "Idle" },
  { value: "speeding", label: "Speeding" },
];

describe("AlertFilters", () => {
  it("reports each select change", async () => {
    const onChange = vi.fn();
    render(
      <AlertFilters
        values={emptyAlertFilters}
        typeOptions={typeOptions}
        onChange={onChange}
        onReset={() => undefined}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Status"), "open");
    expect(onChange).toHaveBeenLastCalledWith({ status: "open" });

    await userEvent.selectOptions(screen.getByLabelText("Type"), "speeding");
    expect(onChange).toHaveBeenLastCalledWith({ type: "speeding" });

    await userEvent.selectOptions(screen.getByLabelText("Severity"), "critical");
    expect(onChange).toHaveBeenLastCalledWith({ severity: "critical" });
  });

  it("debounces the plate search", async () => {
    const onChange = vi.fn();
    render(
      <AlertFilters
        values={emptyAlertFilters}
        typeOptions={typeOptions}
        onChange={onChange}
        onReset={() => undefined}
      />,
    );

    await userEvent.type(screen.getByLabelText("Search plate"), "LSD");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ q: "LSD" }));
  });

  it("enables Reset only when a filter is active", async () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <AlertFilters
        values={emptyAlertFilters}
        typeOptions={typeOptions}
        onChange={() => undefined}
        onReset={onReset}
      />,
    );
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();

    rerender(
      <AlertFilters
        values={{ ...emptyAlertFilters, severity: "high" }}
        typeOptions={typeOptions}
        onChange={() => undefined}
        onReset={onReset}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
