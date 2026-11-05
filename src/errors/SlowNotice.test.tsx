import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("offers Cancel and Retry only once the request is long", async () => {
    vi.useFakeTimers();
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    render(<SlowNotice onCancel={onCancel} onRetry={onRetry} />);

    await act(async () => vi.advanceTimersByTime(3_000));
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(7_000));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
