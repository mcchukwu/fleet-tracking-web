import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "./SearchInput";

afterEach(() => {
  vi.useRealTimers();
});

describe("SearchInput", () => {
  it("shows each keystroke but emits the value after 150ms", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ab 12" } });

    expect(screen.getByRole("searchbox")).toHaveValue("ab 12");
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("ab 12");
  });

  it("adopts a value set by the parent", () => {
    const { rerender } = render(<SearchInput value="ABC" onChange={vi.fn()} />);
    expect(screen.getByRole("searchbox")).toHaveValue("ABC");

    rerender(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});
