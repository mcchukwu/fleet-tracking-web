import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangeVehicleDialog } from "./ChangeVehicleDialog";

vi.mock("./VehiclePicker", () => ({
  VehiclePicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange("vehicle-2")}>
      Pick another vehicle
    </button>
  ),
}));

describe("ChangeVehicleDialog", () => {
  it("selects a vehicle and closes", async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <ChangeVehicleDialog
        open
        value="vehicle-1"
        onChange={onChange}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Change vehicle" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Pick another vehicle" }));
    expect(onChange).toHaveBeenCalledWith("vehicle-2");
    expect(onClose).toHaveBeenCalled();
  });
});
