import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../../ui/Tooltip";
import { ImportFilePicker } from "./ImportFilePicker";

function view(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

function input(): HTMLInputElement {
  return screen.getByTestId("import-file-input") as HTMLInputElement;
}

describe("ImportFilePicker", () => {
  it("passes a chosen file to the caller", async () => {
    const onSelect = vi.fn();
    view(
      <ImportFilePicker
        file={null}
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );

    const file = new File(["imei\n1"], "vehicles.csv", { type: "text/csv" });
    await userEvent.upload(input(), file);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toBe(file);
  });

  it("accepts a dropped file and offers a keyboard alternative", () => {
    const onSelect = vi.fn();
    view(
      <ImportFilePicker
        file={null}
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );

    const file = new File(["imei\n1"], "vehicles.csv", { type: "text/csv" });
    fireEvent.drop(screen.getByTestId("import-drop-zone"), {
      dataTransfer: { files: [file] },
    });

    expect(onSelect).toHaveBeenCalledWith(file);
    expect(screen.getByRole("button", { name: "Choose file" })).toBeInTheDocument();
  });

  it("summarises the selected file and clears it", async () => {
    const onClear = vi.fn();
    const file = new File(["x".repeat(2048)], "fleet.csv", { type: "text/csv" });
    view(
      <ImportFilePicker file={file} onSelect={vi.fn()} onClear={onClear} />,
    );

    expect(screen.getByText("fleet.csv")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose another file" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Remove selected file" }),
    );
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("emphasizes the file action when the preview is invalid", () => {
    const file = new File(["x"], "fleet.csv", { type: "text/csv" });
    view(
      <ImportFilePicker
        file={file}
        emphasized
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Choose another file" }).className,
    ).toContain("bg-accent");
  });

  it("keeps the control visible but inert while disabled", async () => {
    const onSelect = vi.fn();
    view(
      <ImportFilePicker
        file={null}
        disabled
        disabledReason="You're offline."
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Choose file" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores a drop while disabled", () => {
    const onSelect = vi.fn();
    view(
      <ImportFilePicker
        file={null}
        disabled
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );

    fireEvent.drop(screen.getByTestId("import-drop-zone"), {
      dataTransfer: {
        files: [new File(["imei\n1"], "vehicles.csv", { type: "text/csv" })],
      },
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not put the hidden file input in the tab order", () => {
    view(
      <ImportFilePicker file={null} onSelect={vi.fn()} onClear={vi.fn()} />,
    );
    expect(input().tabIndex).toBe(-1);
  });
});
