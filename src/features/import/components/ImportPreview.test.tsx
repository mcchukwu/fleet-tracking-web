import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { ImportPreview as Preview } from "../lib/preview";
import { ImportPreview } from "./ImportPreview";

const preview: Preview = {
  headers: ["imei", "plate", "year"],
  headerRow: ["imei", "plate", "year"],
  rows: [
    ["imei-1", "LSD-100-AA", "2021"],
    ["imei-2", "LSD-101-AA", "2022"],
  ],
  unknownHeaders: [],
  duplicateHeaders: [],
  bom: false,
};

function view(ui: React.ReactNode) {
  return render(
    <TooltipProvider>
      <ToastProvider>{ui}</ToastProvider>
    </TooltipProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ImportPreview", () => {
  it("renders the first rows in the shared table", () => {
    view(<ImportPreview preview={preview} state="ready" />);

    expect(screen.getByText("First 5 rows")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "CSV preview" });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "imei" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "plate" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "LSD-100-AA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy imei imei-1/i })).toBeInTheDocument();
  });

  it("shows a blocking preview error as an alert", () => {
    view(
      <ImportPreview
        preview={null}
        state="error"
        error={{
          title: "This file has no imei column.",
          detail: "Add an imei header and try again.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This file has no imei column.");
  });

  it("shows a skeleton after the 200ms delay while parsing", () => {
    vi.useFakeTimers();
    view(<ImportPreview preview={null} state="loading" />);
    expect(screen.queryByTestId("import-preview-loading")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId("import-preview-loading")).toBeInTheDocument();
  });

  it("renders nothing before a file is chosen", () => {
    const { container } = view(<ImportPreview preview={null} state="idle" />);
    expect(container).toBeEmptyDOMElement();
  });
});
