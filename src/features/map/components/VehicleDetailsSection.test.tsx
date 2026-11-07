import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../../../ui/Toast";
import { VehicleDetailsSection } from "./VehicleDetailsSection";

const vehicle = {
  id: "vehicle-1",
  external_id: "demo-imei-0001",
  plate: "LSD-100-AA",
  vehicle_type: "tanker",
  make: "MAN",
  model: "TGS",
  year: 2021,
  colour: "white",
  status: "active",
  depot: "Lekki Depot",
  department: "operations",
  online: true,
};

describe("VehicleDetailsSection", () => {
  it("shows every field and a copyable IMEI", () => {
    render(
      <ToastProvider>
        <VehicleDetailsSection vehicle={vehicle} />
      </ToastProvider>,
    );
    expect(screen.getByText("demo-imei-0001")).toBeVisible();
    expect(screen.getByText("tanker")).toBeVisible();
    expect(screen.getByText("MAN")).toBeVisible();
    expect(screen.getByText("TGS")).toBeVisible();
    expect(screen.getByText("2021")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("Lekki Depot")).toBeVisible();
    expect(screen.getByText("operations")).toBeVisible();
  });

  it("shows dashes and the write-only note for device fields", () => {
    render(
      <ToastProvider>
        <VehicleDetailsSection vehicle={vehicle} />
      </ToastProvider>,
    );
    expect(screen.getByText("Device fields aren't returned by the API.")).toBeVisible();
    expect(screen.getByText("SIM number")).toBeVisible();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("shows the raw unknown administrative status", () => {
    render(
      <ToastProvider>
        <VehicleDetailsSection vehicle={{ ...vehicle, status: "reserved" }} />
      </ToastProvider>,
    );
    expect(screen.getByText("Reserved")).toBeVisible();
  });
});
