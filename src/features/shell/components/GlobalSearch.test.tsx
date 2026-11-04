import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "./GlobalSearch";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

describe("GlobalSearch", () => {
  it("navigates to the map with the typed query", async () => {
    navigate.mockReset();
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("searchbox", { name: "Search vehicles" }), "KJA 123{Enter}");

    expect(navigate).toHaveBeenCalledWith({ to: "/map", search: { q: "KJA 123" } });
  });

  it("navigates without a query when the field is empty", async () => {
    navigate.mockReset();
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("searchbox", { name: "Search vehicles" }), "   {Enter}");

    expect(navigate).toHaveBeenCalledWith({ to: "/map", search: {} });
  });

  it("focuses the input when it opens on mobile", async () => {
    render(<GlobalSearch focusOnMount />);
    expect(screen.getByRole("searchbox", { name: "Search vehicles" })).toHaveFocus();
  });

  it("clears the query with the clear button and Escape", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);
    const search = screen.getByRole("searchbox", { name: "Search vehicles" });

    await user.type(search, "KJA 123");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();

    await user.type(search, "KJA 123");
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
  });
});
