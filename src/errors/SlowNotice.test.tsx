import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlowNotice } from "./SlowNotice";

afterEach(() => {
  vi.useRealTimers();
});

describe("SlowNotice", () => {
  it("reports progress at three seconds and a long request at ten", async () => {
    vi.useFakeTimers();
    render(<SlowNotice />);
    expect(screen.queryByText("Still working…")).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(3_000));
    expect(screen.getByText("Still working…")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(7_000));
    expect(screen.getByText("Taking longer than usual")).toBeInTheDocument();
  });
});
