import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePlaybackShortcuts } from "./usePlaybackShortcuts";

function renderShortcuts() {
  const actions = {
    onToggle: vi.fn(),
    onStep: vi.fn(),
    onSpeed: vi.fn(),
  };
  renderHook(() => usePlaybackShortcuts(actions));
  return actions;
}

function press(key: string, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("usePlaybackShortcuts", () => {
  it("maps Space, arrows and comma/period", () => {
    const actions = renderShortcuts();
    expect(press(" ").defaultPrevented).toBe(true);
    press("ArrowLeft");
    press("ArrowRight");
    press(",");
    press(".");
    expect(actions.onToggle).toHaveBeenCalledTimes(1);
    expect(actions.onStep.mock.calls).toEqual([[-1], [1]]);
    expect(actions.onSpeed.mock.calls).toEqual([[-1], [1]]);
  });

  it("ignores typing, sliders, buttons and open menus", () => {
    const actions = renderShortcuts();
    const input = document.createElement("input");
    document.body.append(input);
    press(" ", input);

    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    document.body.append(slider);
    press("ArrowRight", slider);

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.append(menu);
    press(" ", menu);

    expect(actions.onToggle).not.toHaveBeenCalled();
    expect(actions.onStep).not.toHaveBeenCalled();
    input.remove();
    slider.remove();
    menu.remove();
  });
});
