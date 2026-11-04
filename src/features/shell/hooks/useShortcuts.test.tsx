import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useShortcuts } from "./useShortcuts";

function Harness({ onNavigate = vi.fn() }: { onNavigate?: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  useShortcuts({ onOpenShortcuts: () => setOpen(true), onNavigate, onEscape: () => undefined });
  return (
    <div>
      <input aria-label="Note" />
      <div id="vehicle-search" tabIndex={-1} aria-label="Vehicle search target" />
      <output>{open ? "shortcuts open" : "shortcuts closed"}</output>
      <dialog open aria-label="Open dialog">
        dialog
      </dialog>
    </div>
  );
}

function HarnessWithoutDialog({
  onNavigate,
  onEscape = vi.fn(),
}: {
  onNavigate: (path: string) => void;
  onEscape?: () => void;
}) {
  const [open, setOpen] = useState(false);
  useShortcuts({ onOpenShortcuts: () => setOpen(true), onNavigate, onEscape });
  useEffect(() => {
    const focus = () => document.getElementById("vehicle-search")?.focus();
    window.addEventListener("fleet:focus-search", focus);
    return () => window.removeEventListener("fleet:focus-search", focus);
  }, []);
  return (
    <div>
      <input aria-label="Note" />
      <div id="vehicle-search" tabIndex={-1} aria-label="Vehicle search target" />
      <output>{open ? "shortcuts open" : "shortcuts closed"}</output>
    </div>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useShortcuts", () => {
  it("focuses the vehicle search on /", () => {
    render(<HarnessWithoutDialog onNavigate={vi.fn()} />);
    fireEvent.keyDown(window, { key: "/" });
    expect(document.getElementById("vehicle-search")).toHaveFocus();
  });

  it("opens the shortcuts dialog on ?", () => {
    render(<HarnessWithoutDialog onNavigate={vi.fn()} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByText("shortcuts open")).toBeVisible();
  });

  it("closes the transient view on Escape", () => {
    const onEscape = vi.fn();
    render(<HarnessWithoutDialog onNavigate={vi.fn()} onEscape={onEscape} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("does not close the transient view while typing or when a dialog is open", () => {
    const onEscape = vi.fn();
    render(<HarnessWithoutDialog onNavigate={vi.fn()} onEscape={onEscape} />);
    const input = screen.getByRole("textbox", { name: "Note" });
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onEscape).not.toHaveBeenCalled();

    render(<Harness onNavigate={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("navigates on a g chord", () => {
    const onNavigate = vi.fn();
    render(<HarnessWithoutDialog onNavigate={onNavigate} />);

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "a" });

    expect(onNavigate).toHaveBeenCalledWith("/alerts");
  });

  it("expires the chord after one second", () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    render(<HarnessWithoutDialog onNavigate={onNavigate} />);

    fireEvent.keyDown(window, { key: "g" });
    vi.advanceTimersByTime(1_100);
    fireEvent.keyDown(window, { key: "a" });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("clears the chord on an unmapped key", () => {
    const onNavigate = vi.fn();
    render(<HarnessWithoutDialog onNavigate={onNavigate} />);

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "x" });
    fireEvent.keyDown(window, { key: "a" });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("does not fire while typing in an input", () => {
    const onNavigate = vi.fn();
    render(<HarnessWithoutDialog onNavigate={onNavigate} />);
    const input = screen.getByRole("textbox", { name: "Note" });
    input.focus();

    fireEvent.keyDown(input, { key: "?" });
    fireEvent.keyDown(input, { key: "g" });
    fireEvent.keyDown(input, { key: "m" });

    expect(screen.getByText("shortcuts closed")).toBeVisible();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("does not fire while a dialog is open", () => {
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} />);

    fireEvent.keyDown(window, { key: "?" });
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "m" });

    expect(screen.getByText("shortcuts closed")).toBeVisible();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
