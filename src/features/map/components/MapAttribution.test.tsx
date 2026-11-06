import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapAttribution } from "./MapAttribution";

const satellite = {
  tilesUrl: "https://tiles.example.com/{z}/{x}/{y}.jpg",
  attribution: "© Example imagery",
};

describe("MapAttribution", () => {
  it("links the standard basemap credit", () => {
    render(<MapAttribution styleId="standard" />);
    const link = screen.getByRole("link", { name: /OpenStreetMap/ });
    expect(link).toHaveAttribute("href", "https://openfreemap.org");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("keeps the licence chip on one 11px line", () => {
    render(<MapAttribution styleId="standard" />);
    const link = screen.getByRole("link", { name: /OpenStreetMap/ });
    expect(link).toHaveClass("whitespace-nowrap", "text-2xs");
  });

  it("renders the satellite credit as text when no link is configured", () => {
    render(<MapAttribution styleId="satellite" satellite={satellite} />);
    expect(screen.getByText("© Example imagery")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links the satellite credit when its licence URL is known", () => {
    render(
      <MapAttribution
        styleId="satellite"
        satellite={{ ...satellite, attributionHref: "https://example.com/licence" }}
      />,
    );
    expect(screen.getByRole("link", { name: "© Example imagery" })).toHaveAttribute(
      "href",
      "https://example.com/licence",
    );
  });
});
