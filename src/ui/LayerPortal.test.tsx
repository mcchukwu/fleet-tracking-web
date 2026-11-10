import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isPortalledPopoverTarget, LayerPortal } from "./LayerPortal";

describe("LayerPortal", () => {
  it("renders into the container for its layer", () => {
    render(
      <LayerPortal layer="popover">
        <div>Menu content</div>
      </LayerPortal>,
    );

    const container = document.querySelector('[data-layer-portal="popover"]');
    expect(container).not.toBeNull();
    expect(container).toContainElement(screen.getByText("Menu content"));
    expect(container?.parentElement?.id).toBe("overlay-root");
    expect(container?.className).toContain("z-popover");
  });

  it("recognises a pointer target inside a portalled popover", () => {
    render(
      <LayerPortal layer="popover">
        <button type="button">Option</button>
      </LayerPortal>,
    );

    expect(isPortalledPopoverTarget(screen.getByRole("button"))).toBe(true);
    expect(isPortalledPopoverTarget(document.body)).toBe(false);
    expect(isPortalledPopoverTarget(null)).toBe(false);
  });
});
