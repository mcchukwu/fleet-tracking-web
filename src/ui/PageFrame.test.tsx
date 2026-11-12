import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageFrame } from "./PageFrame";

function frame(): HTMLElement {
  return document.querySelector<HTMLElement>("[data-page-frame]") as HTMLElement;
}

function content(): HTMLElement {
  return document.querySelector<HTMLElement>(
    "[data-page-frame-content]",
  ) as HTMLElement;
}

describe("PageFrame", () => {
  it("clips a fill frame and leaves scrolling to inner regions", () => {
    render(
      <PageFrame layout="fill">
        <div>Map</div>
      </PageFrame>,
    );

    expect(frame()).toHaveAttribute("data-page-frame", "fill");
    expect(frame().className).toContain("overflow-hidden");
    expect(frame().className).not.toContain("overflow-y-auto");
    expect(content().className).toContain("flex-1");
  });

  it("is the one scroller and the one bottom inset on a scroll frame", () => {
    render(
      <PageFrame layout="scroll">
        <div>Report</div>
      </PageFrame>,
    );

    expect(frame()).toHaveAttribute("data-page-frame", "scroll");
    expect(frame().className).toContain("overflow-y-auto");
    expect(content().className).toContain("page-frame-end");
    expect(content().className).not.toContain("min-h-screen");
  });

  it("wraps the content exactly once and caps the default width", () => {
    render(
      <PageFrame layout="scroll">
        <p>Only child</p>
      </PageFrame>,
    );

    expect(screen.getByText("Only child").parentElement).toBe(content());
    expect(document.querySelectorAll("[data-page-frame-content]")).toHaveLength(1);
    expect(content().className).toContain("max-w-content");
    expect(content().className).toContain("mx-auto");
  });

  it("can use the full width", () => {
    render(
      <PageFrame layout="scroll" width="full">
        <p>Wide</p>
      </PageFrame>,
    );

    expect(content().className).not.toContain("max-w-content");
  });

  it("centres short content by filling the frame, not by a page minimum", () => {
    render(
      <PageFrame layout="scroll" align="center">
        <p>Sign in</p>
      </PageFrame>,
    );

    expect(content().className).toContain("justify-center");
    expect(content().className).toContain("min-h-full");
    expect(content().className).not.toContain("min-h-screen");
  });
});
