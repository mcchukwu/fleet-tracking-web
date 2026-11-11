import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../../ui/Tooltip";
import { ToastProvider } from "../../../ui/Toast";
import type { ImportPreview as Preview } from "../lib/preview";
import { ImportExpectedHeaders } from "./ImportExpectedHeaders";

const preview: Preview = {
  headers: ["imei", "plate", "colour_code"],
  headerRow: ["imei", "plate", "colour_code"],
  rows: [["imei-1", "LSD-100-AA", "red"]],
  unknownHeaders: ["colour_code"],
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

describe("ImportExpectedHeaders", () => {
  it("shows the exact header row with a short copy label", () => {
    view(<ImportExpectedHeaders preview={null} onDownloadSample={vi.fn()} />);
    expect(screen.getByTestId("import-header-row")).toHaveTextContent(
      "imei,sim_number,device_model,protocol,plate,vehicle_type,make,model,year,colour,chassis_number,depot,department,driver_name,driver_phone,driver_licence",
    );
    expect(
      screen.getByRole("button", { name: "Copy header row" }),
    ).toBeInTheDocument();
  });

  it("downloads the sample CSV", async () => {
    const onDownloadSample = vi.fn();
    view(
      <ImportExpectedHeaders
        preview={null}
        onDownloadSample={onDownloadSample}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Download sample CSV" }),
    );
    expect(onDownloadSample).toHaveBeenCalledTimes(1);
  });

  it("warns about unknown and duplicate headers without blocking", () => {
    view(
      <ImportExpectedHeaders
        preview={{ ...preview, duplicateHeaders: ["plate"] }}
        onDownloadSample={vi.fn()}
      />,
    );
    expect(screen.getByText(/Unknown column: colour_code/)).toBeInTheDocument();
    expect(screen.getByText(/Duplicate column: plate/)).toBeInTheDocument();
  });
});
