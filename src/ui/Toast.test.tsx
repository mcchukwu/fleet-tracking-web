import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Harness() {
  const { toast } = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() => toast({ title: "Trip created", tone: "success", key: "trip-created" })}
      >
        Show success
      </button>
      <button
        type="button"
        onClick={() => toast({ title: "Trip updated", tone: "success", key: "trip-updated" })}
      >
        Show another success
      </button>
      <button
        type="button"
        onClick={() =>
          toast({
            title: "Couldn't save",
            description: "Check your connection.",
            tone: "error",
            key: "save-failed",
          })
        }
      >
        Show error
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("auto-dismisses a success toast after four seconds", async () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    expect(screen.getByText("Trip created")).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(screen.queryByText("Trip created")).not.toBeInTheDocument();
  });

  it("keeps an error toast until it is dismissed", async () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Show error" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("Couldn't save")).toBeVisible();
    expect(
      screen.getAllByRole("status").some((node) => node.getAttribute("aria-live") === "assertive"),
    ).toBe(true);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText("Couldn't save")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Couldn't save")).not.toBeInTheDocument();
  });

  it("collapses the same tone and key inside ten seconds", async () => {
    renderHarness();
    const button = screen.getByRole("button", { name: "Show success" });

    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    fireEvent.click(button);

    expect(screen.getAllByText("Trip created")).toHaveLength(1);
  });

  it("keeps later toasts auto-dismissing after a toast is swiped away", () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    const viewport = screen.getByRole("region", { name: /Notifications/ });
    fireEvent.pointerMove(viewport);

    const toast = screen.getByText("Trip created").closest("li");
    if (!toast) throw new Error("expected a toast");
    Object.defineProperty(toast, "setPointerCapture", { value: vi.fn() });
    Object.defineProperty(toast, "releasePointerCapture", { value: vi.fn() });
    Object.defineProperty(toast, "hasPointerCapture", { value: vi.fn(() => false) });
    fireEvent.pointerDown(toast, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(toast, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(toast, { clientX: 100, clientY: 0, pointerId: 1 });
    expect(screen.queryByText("Trip created")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show another success" }));
    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(screen.queryByText("Trip updated")).not.toBeInTheDocument();
  });

  it("keeps auto-dismissing the other toast after one of two is closed by hand", () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    fireEvent.click(screen.getByRole("button", { name: "Show another success" }));

    const viewport = screen.getByRole("region", { name: /Notifications/ });
    fireEvent.pointerMove(viewport);
    const [first] = screen.getAllByRole("button", { name: "Dismiss" });
    if (!first) throw new Error("expected a dismiss button");
    first.focus();
    fireEvent.click(first);
    expect(screen.queryByText("Trip created")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(screen.queryByText("Trip updated")).not.toBeInTheDocument();
  });

  it("auto-dismisses a later success toast after an earlier one was closed by hand", () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    const viewport = screen.getByRole("region", { name: /Notifications/ });
    fireEvent.pointerMove(viewport);

    const close = screen.getByRole("button", { name: "Dismiss" });
    close.focus();
    fireEvent.click(close);
    expect(screen.queryByText("Trip created")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show another success" }));
    expect(screen.getByText("Trip updated")).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(screen.queryByText("Trip updated")).not.toBeInTheDocument();
  });

  it("announces success politely", async () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(
      screen.getAllByRole("status").some((node) => node.getAttribute("aria-live") === "polite"),
    ).toBe(true);
  });
});
