import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";
import { ToastProvider } from "./Toast";

function withProviders(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("CopyButton", () => {
  it("copies the value and confirms with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    withProviders(<CopyButton value="LSD-100-AA" label="Plate" />);
    await userEvent.click(screen.getByRole("button", { name: /copy plate lsd-100-aa/i }));

    expect(writeText).toHaveBeenCalledWith("LSD-100-AA");
    expect(await screen.findByText("Plate copied")).toBeInTheDocument();
  });

  it("keeps a compact height when used inline in a vehicle row", () => {
    withProviders(<CopyButton inline value="LSD-100-AA" label="Plate" />);
    const button = screen.getByRole("button", { name: /copy plate/i });
    expect(button).toHaveClass("h-6");
    expect(button).not.toHaveClass("h-touch");
  });

  it("shows the clipboard failure copy when the browser denies access", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    withProviders(<CopyButton value="demo-imei-0001" label="IMEI" />);
    await userEvent.click(screen.getByRole("button", { name: /copy imei/i }));

    expect(await screen.findByText("Couldn't copy")).toBeInTheDocument();
    expect(screen.getByText("Select the text and press Ctrl+C.")).toBeInTheDocument();
  });

  it("treats a missing clipboard API as a clipboard failure", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });

    withProviders(<CopyButton value="LSD-100-AA" label="Plate" />);
    await userEvent.click(screen.getByRole("button", { name: /copy plate/i }));

    expect(await screen.findByText("Couldn't copy")).toBeInTheDocument();
  });
});
