import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveRegionProvider, useLiveRegion } from "./LiveRegion";

function Announcer() {
  const { announce } = useLiveRegion();
  return (
    <>
      <button type="button" onClick={() => announce("One")}>
        One
      </button>
      <button type="button" onClick={() => announce("Two")}>
        Two
      </button>
      <button type="button" onClick={() => announce("Three")}>
        Three
      </button>
    </>
  );
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("LiveRegion", () => {
  it("announces immediately, then batches and throttles for five seconds", () => {
    vi.useFakeTimers();
    render(
      <LiveRegionProvider>
        <Announcer />
      </LiveRegionProvider>,
    );
    const region = () => screen.getByRole("status");

    act(() => {
      screen.getByRole("button", { name: "One" }).click();
    });
    advance(0);
    expect(region()).toHaveTextContent("One");

    act(() => {
      screen.getByRole("button", { name: "Two" }).click();
      screen.getByRole("button", { name: "Three" }).click();
    });
    advance(4_999);
    expect(region()).toHaveTextContent("One");

    advance(1);
    expect(region()).toHaveTextContent("Two. Three");
  });

  it("does not repeat an identical pending announcement", () => {
    vi.useFakeTimers();
    render(
      <LiveRegionProvider>
        <Announcer />
      </LiveRegionProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "One" }).click();
    });
    advance(0);
    act(() => {
      screen.getByRole("button", { name: "One" }).click();
    });
    advance(5_000);
    expect(screen.getByRole("status")).toHaveTextContent("One");
  });
});
