import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TripFilters } from "./TripFilters";

describe("TripFilters", () => {
  it("reports status and order changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TripFilters
        values={{ status: null, q: "", sort: "status" }}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Status"), "active");
    expect(onChange).toHaveBeenCalledWith({ status: "active" });

    await user.selectOptions(screen.getByLabelText("Sort"), "started");
    expect(onChange).toHaveBeenCalledWith({ sort: "started" });
  });

  it("debounces search and resets only when a filter exists", async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <TripFilters
        values={{ status: null, q: "", sort: "status" }}
        onChange={onChange}
        onReset={onReset}
      />,
    );

    await user.type(screen.getByLabelText("Search trips"), "lsd");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ q: "lsd" }));
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();

    rerender(
      <TripFilters
        values={{ status: "active", q: "lsd", sort: "status" }}
        onChange={onChange}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalled();
  });
});
