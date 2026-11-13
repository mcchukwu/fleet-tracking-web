import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReportsRangePicker } from "./ReportsRangePicker";

describe("ReportsRangePicker", () => {
  it("shows the active preset as the trigger label", () => {
    render(
      <ReportsRangePicker preset="7d" onPreset={() => undefined} onCustom={() => undefined} />,
    );
    expect(screen.getByRole("button", { name: "Range, 7 days" })).toBeVisible();
  });

  it("labels a custom range as Custom", () => {
    render(
      <ReportsRangePicker preset={null} onPreset={() => undefined} onCustom={() => undefined} />,
    );
    expect(screen.getByRole("button", { name: "Range, Custom" })).toBeVisible();
  });

  it("reports the chosen preset", async () => {
    const user = userEvent.setup();
    const onPreset = vi.fn();
    render(<ReportsRangePicker preset="7d" onPreset={onPreset} onCustom={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Range, 7 days" }));
    await user.click(screen.getByRole("menuitemradio", { name: "24 hours" }));
    expect(onPreset).toHaveBeenCalledWith("24h");
  });

  it("opens the custom range from the menu", async () => {
    const user = userEvent.setup();
    const onCustom = vi.fn();
    render(<ReportsRangePicker preset="7d" onPreset={() => undefined} onCustom={onCustom} />);
    await user.click(screen.getByRole("button", { name: "Range, 7 days" }));
    await user.click(screen.getByRole("menuitem", { name: "Custom range…" }));
    expect(onCustom).toHaveBeenCalledTimes(1);
  });
});
