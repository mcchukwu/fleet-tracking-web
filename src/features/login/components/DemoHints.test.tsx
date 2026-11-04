import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PASSWORD, DemoHints, demoAccounts, demoHintsEnabled } from "./DemoHints";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demoHintsEnabled", () => {
  it("requires both the dev build and the staging flag", () => {
    expect(demoHintsEnabled({ DEV: true, VITE_DEMO_HINTS: "1" })).toBe(true);
    expect(demoHintsEnabled({ DEV: false, VITE_DEMO_HINTS: "1" })).toBe(false);
    expect(demoHintsEnabled({ DEV: true, VITE_DEMO_HINTS: "0" })).toBe(false);
    expect(demoHintsEnabled({ DEV: true })).toBe(false);
  });
});

describe("DemoHints", () => {
  it("is not rendered in a production build", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEMO_HINTS", "1");
    render(<DemoHints onPrefill={() => undefined} />);
    expect(screen.queryByText("Demo accounts")).not.toBeInTheDocument();
  });

  it("prefills each demo account and moves focus to submit", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEMO_HINTS", "1");
    const user = userEvent.setup();
    const onPrefill = vi.fn();
    const submitRef = createRef<HTMLButtonElement>();

    render(
      <>
        <DemoHints onPrefill={onPrefill} submitRef={submitRef} />
        <button ref={submitRef} type="submit">
          Sign in
        </button>
      </>,
    );

    for (const account of demoAccounts) {
      await user.click(screen.getByRole("button", { name: account.label }));
      expect(onPrefill).toHaveBeenLastCalledWith(account.email, DEMO_PASSWORD);
      expect(submitRef.current).toHaveFocus();
    }
  });
});
