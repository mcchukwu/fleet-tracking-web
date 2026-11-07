import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapTilerLogo } from "./MapTilerLogo";

describe("MapTilerLogo", () => {
  it("links to MapTiler with an accessible name", () => {
    render(<MapTilerLogo />);
    const link = screen.getByRole("link", { name: "MapTiler" });
    expect(link).toHaveAttribute("href", "https://www.maptiler.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("swaps the wordmark with the theme", () => {
    const { container } = render(<MapTilerLogo />);
    const images = [...container.querySelectorAll("img")];
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "/maptiler-logo-light.svg",
      "/maptiler-logo-dark.svg",
    ]);
    expect(images[0]).toHaveClass("dark:hidden");
    expect(images[1]).toHaveClass("dark:block");
  });
});
