import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VehicleDriverSection } from "./VehicleDriverSection";

describe("VehicleDriverSection", () => {
  it("shows a tel link for a driver with a phone", () => {
    render(<VehicleDriverSection driverName="Adebayo Okafor" driverPhone="08031000010" />);
    expect(screen.getByText("Adebayo Okafor")).toBeVisible();
    expect(screen.getByRole("link", { name: "08031000010" })).toHaveAttribute(
      "href",
      "tel:08031000010",
    );
  });

  it("shows the no-driver state", () => {
    render(<VehicleDriverSection driverName={null} driverPhone={null} />);
    expect(screen.getByText("No driver assigned.")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the dash when the phone is missing", () => {
    render(<VehicleDriverSection driverName="Adebayo Okafor" driverPhone={null} />);
    expect(screen.getByText("—")).toBeVisible();
  });
});
