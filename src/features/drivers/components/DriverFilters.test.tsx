import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DriverFilters } from "./DriverFilters";

describe("DriverFilters", () => {
  it("reports status changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DriverFilters
        values={{ status: null, q: "" }}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Status"), "inactive");
    expect(onChange).toHaveBeenCalledWith({ status: "inactive" });
  });

  it("debounces the search and resets only when a filter exists", async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <DriverFilters values={{ status: null, q: "" }} onChange={onChange} onReset={onReset} />,
    );

    await user.type(screen.getByLabelText("Search drivers"), "ada");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ q: "ada" }));
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();

    rerender(
      <DriverFilters
        values={{ status: "active", q: "ada" }}
        onChange={onChange}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalled();
  });
});
