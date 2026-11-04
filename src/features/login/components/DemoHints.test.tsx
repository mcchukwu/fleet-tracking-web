import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEMO_PASSWORD, DemoHints, demoAccounts } from "./DemoHints";

describe("DemoHints", () => {
  it("prefills each demo account and moves focus to submit", async () => {
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
