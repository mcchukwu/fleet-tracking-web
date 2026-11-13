import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertRule } from "../../../api/types";
import { ApiError } from "../../../errors/types";
import { normalize } from "../../../errors/normalize";
import { useConnectionStore } from "../../../stores/connection";
import { TooltipProvider } from "../../../ui/Tooltip";
import { AlertRulesPanel } from "./AlertRulesPanel";

const mocks = vi.hoisted(() => ({
  canMutate: true,
  rules: {
    data: [] as AlertRule[],
    isPending: false,
    isLoading: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  write: {
    toggle: vi.fn(),
    saveConfig: vi.fn(),
    pendingId: null as string | null,
    error: null as unknown,
    clearError: vi.fn(),
  },
}));

vi.mock("../../../auth/useCanMutate", async () => {
  const { useConnection } = await import("../../../stores/connection");
  return {
    useCanMutate: (_capability: string, roleReason?: string) => {
      const { network } = useConnection();
      if (!mocks.canMutate) {
        return {
          allowed: false,
          roleAllowed: false,
          blockedBy: "role",
          reason: roleReason ?? "Your role can't make changes.",
        };
      }
      if (network === "offline") {
        return {
          allowed: false,
          roleAllowed: true,
          blockedBy: "offline",
          reason: "You're offline.",
        };
      }
      return { allowed: true, roleAllowed: true, blockedBy: null, reason: null };
    },
  };
});

vi.mock("../../../api/hooks/alerts", () => ({
  useAlertRules: () => mocks.rules,
}));

vi.mock("../hooks/useAlertRulesWrite", () => ({
  useAlertRulesWrite: () => mocks.write,
}));

const speeding: AlertRule = {
  id: "rule-1",
  type: "speeding",
  enabled: true,
  config: { speed_kph: 80, duration_s: 120 },
};

const unknown: AlertRule = {
  id: "rule-2",
  type: "solar_flare",
  enabled: false,
  config: { threshold: 5 },
};

beforeEach(() => {
  mocks.canMutate = true;
  mocks.rules.data = [speeding, unknown];
  mocks.rules.isPending = false;
  mocks.rules.isLoading = false;
  mocks.rules.error = null;
  mocks.write.pendingId = null;
  mocks.write.error = null;
  mocks.write.toggle.mockReset();
  mocks.write.saveConfig.mockReset();
  useConnectionStore.setState({ network: "online" });
});

function renderRules() {
  return render(
    <TooltipProvider>
      <AlertRulesPanel />
    </TooltipProvider>,
  );
}

describe("AlertRulesPanel", () => {
  it("lists known and unknown rules", () => {
    renderRules();
    expect(screen.getByText("Speeding")).toBeVisible();
    expect(screen.getByText("Unknown type: solar_flare")).toBeVisible();
    expect(screen.getByText("This rule type has no settings editor.")).toBeVisible();
    expect(screen.getByText("Threshold")).toBeVisible();
  });

  it("toggles a rule and saves a full config", async () => {
    renderRules();
    const enables = screen.getByRole("checkbox", { name: "Enabled Speeding rule" });
    await userEvent.click(enables);
    expect(mocks.write.toggle).toHaveBeenCalledWith(speeding, false);

    await userEvent.click(screen.getByRole("button", { name: "Edit settings for Speeding" }));
    const speed = screen.getByLabelText("Speed kph");
    await userEvent.clear(speed);
    await userEvent.type(speed, "81");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(mocks.write.saveConfig).toHaveBeenCalledWith(speeding, {
      speed_kph: 81,
      duration_s: 120,
    });
  });

  it("disables every control for a role that cannot mutate", () => {
    mocks.canMutate = false;
    renderRules();
    expect(screen.getByText("Your role can't change alert rules.")).toBeVisible();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByRole("button", { name: "Edit settings for Speeding" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("explains a role-disabled control with a tooltip", async () => {
    mocks.canMutate = false;
    renderRules();
    await userEvent.hover(screen.getByRole("checkbox", { name: "Enabled Speeding rule" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Your role can't change alert rules.",
    );
  });

  it("shows an inline rule error with Retry", () => {
    mocks.write.error = {
      ruleId: "rule-1",
      error: normalize(new TypeError("Failed to fetch")),
      title: "Couldn't change alert rules",
      detail: "Try again.",
    };
    renderRules();
    expect(screen.getByText("Couldn't change alert rules")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("renders loading, empty and error states", async () => {
    mocks.rules.data = [];
    mocks.rules.isPending = true;
    mocks.rules.isLoading = true;
    const { rerender } = renderRules();
    await waitFor(() => expect(screen.getByLabelText("Loading")).toBeInTheDocument());

    mocks.rules.isPending = false;
    mocks.rules.isLoading = false;
    rerender(
      <TooltipProvider>
        <AlertRulesPanel />
      </TooltipProvider>,
    );
    expect(screen.getByText("No alert rules configured")).toBeVisible();

    mocks.rules.error = normalize(new ApiError(500, "internal", "boom"));
    rerender(
      <TooltipProvider>
        <AlertRulesPanel />
      </TooltipProvider>,
    );
    expect(screen.getByText("Something went wrong on our side")).toBeVisible();
  });
});
