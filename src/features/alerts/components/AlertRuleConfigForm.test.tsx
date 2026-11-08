import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AlertRule } from "../../../api/types";
import { AlertRuleConfigForm } from "./AlertRuleConfigForm";

const rule: AlertRule = {
  id: "rule-1",
  type: "speeding",
  enabled: true,
  config: {
    speed_kph: 80,
    duration_s: 120,
    enabled: true,
    label: "highway",
    nested: { a: 1 },
  },
};

describe("AlertRuleConfigForm", () => {
  it("generates primitive fields and shows nested values read-only", () => {
    render(
      <AlertRuleConfigForm
        rule={rule}
        pending={false}
        onSave={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Speed kph")).toHaveValue(80);
    expect(screen.getByLabelText("Duration s")).toHaveValue(120);
    expect(screen.getByLabelText("Label")).toHaveValue("highway");
    expect(screen.getByRole("checkbox", { name: "Enabled" })).toBeChecked();
    expect(screen.getByText('{"a":1}')).toBeVisible();
  });

  it("blocks an invalid value and sends the full object when valid", async () => {
    const onSave = vi.fn();
    render(
      <AlertRuleConfigForm
        rule={rule}
        pending={false}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Speed kph"));
    await userEvent.type(screen.getByLabelText("Speed kph"), "-1");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a number of 0 or more.")).toBeVisible();

    await userEvent.clear(screen.getByLabelText("Speed kph"));
    await userEvent.type(screen.getByLabelText("Speed kph"), "81");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(onSave).toHaveBeenCalledWith({
      speed_kph: 81,
      duration_s: 120,
      enabled: true,
      label: "highway",
      nested: { a: 1 },
    });
  });

  it("disables the form for a role reason and while pending", () => {
    const { rerender } = render(
      <AlertRuleConfigForm
        rule={rule}
        pending={false}
        disabledReason="Your role can't change alert rules."
        onSave={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Speed kph")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
    expect(screen.getByText("Your role can't change alert rules.")).toBeVisible();

    rerender(
      <AlertRuleConfigForm
        rule={rule}
        pending
        onSave={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
  });

  it("shows No settings for an empty config", () => {
    render(
      <AlertRuleConfigForm
        rule={{ ...rule, config: {} }}
        pending={false}
        onSave={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByText("No settings.")).toBeVisible();
  });
});
