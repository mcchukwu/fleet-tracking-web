import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuditFilters } from "./AuditFilters";

const actionOptions = [
  { value: "auth.login", label: "Login" },
  { value: "trip.create", label: "Create trip" },
];

const emptyValues = { action: null, q: "" };

describe("AuditFilters", () => {
  it("shows all actions first and the current selection", () => {
    render(
      <AuditFilters
        values={{ action: "trip.create", q: "" }}
        actionOptions={actionOptions}
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );

    const select = screen.getByLabelText("Action") as HTMLSelectElement;
    expect(select.value).toBe("trip.create");
    const options = Array.from(select.options).map((option) => option.textContent);
    expect(options).toEqual(["All actions", "Login", "Create trip"]);
  });

  it("reports the action change and debounces the search", async () => {
    const onChange = vi.fn();
    render(
      <AuditFilters
        values={emptyValues}
        actionOptions={actionOptions}
        onChange={onChange}
        onReset={() => undefined}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Action"), "auth.login");
    expect(onChange).toHaveBeenLastCalledWith({ action: "auth.login" });

    await userEvent.selectOptions(screen.getByLabelText("Action"), "");
    expect(onChange).toHaveBeenLastCalledWith({ action: null });

    await userEvent.type(screen.getByLabelText("Search audit log"), "trip");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ q: "trip" }));
  });

  it("enables Reset only with an active filter", async () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <AuditFilters
        values={emptyValues}
        actionOptions={actionOptions}
        onChange={() => undefined}
        onReset={onReset}
      />,
    );
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();

    rerender(
      <AuditFilters
        values={{ action: null, q: "trip" }}
        actionOptions={actionOptions}
        onChange={() => undefined}
        onReset={onReset}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
