import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapAttribution } from "./MapAttribution";

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

  it("renders the style's own MapTiler credit", () => {
    render(
      <MapAttribution
        styleId="satellite"
        attribution={["© MapTiler © OpenStreetMap contributors"]}
      />,
    );
    expect(screen.getByTestId("map-attribution")).toHaveTextContent(
      "© MapTiler © OpenStreetMap contributors",
    );
    expect(screen.queryByRole("link", { name: /OpenStreetMap/ })).not.toBeInTheDocument();
  });

  it("joins credits from more than one style source", () => {
    render(
      <MapAttribution
        styleId="streets"
        attribution={["© MapTiler", "© OpenStreetMap contributors"]}
      />,
    );
    expect(screen.getByTestId("map-attribution")).toHaveTextContent(
      "© MapTiler · © OpenStreetMap contributors",
    );
  });

  it("renders no chip for a hosted style until its credit arrives", () => {
    render(<MapAttribution styleId="satellite" attribution={null} />);
    expect(screen.queryByTestId("map-attribution")).not.toBeInTheDocument();
  });
});
