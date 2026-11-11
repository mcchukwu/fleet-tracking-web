import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { ImportResult } from "../../../api/types";
import { ImportResultPanel } from "./ImportResultPanel";

function view(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const partial: ImportResult = {
  job_id: "job-1",
  total: 12,
  imported: 10,
  failed: 2,
  errors: [
    { row: 3, message: "year must be a number" },
    { row: 5, message: "imei is required" },
  ],
};

describe("ImportResultPanel", () => {
  it("shows the stats, sentence and both actions", async () => {
    const onSearchPlate = vi.fn();
    const onImportAnother = vi.fn();
    view(
      <ImportResultPanel
        result={partial}
        fileName="vehicles.csv"
        onSearchPlate={onSearchPlate}
        onImportAnother={onImportAnother}
        onDownloadErrors={vi.fn()}
      />,
    );

    expect(screen.getByText("Total rows")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByText("10 vehicles imported, 2 rows failed."),
    ).toBeInTheDocument();
    expect(screen.getByText("vehicles.csv")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Search a plate" }));
    expect(onSearchPlate).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Import another file" }),
    );
    expect(onImportAnother).toHaveBeenCalledTimes(1);
  });

  it("caps the row-error table at 100 and says how many were returned", () => {
    const capped: ImportResult = {
      ...partial,
      total: 110,
      imported: 5,
      failed: 105,
      errors: Array.from({ length: 100 }, (_, index) => ({
        row: index + 2,
        message: `Row ${index + 2} failed`,
      })),
    };
    view(
      <ImportResultPanel
        result={capped}
        fileName="big.csv"
        onSearchPlate={vi.fn()}
        onImportAnother={vi.fn()}
        onDownloadErrors={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Showing the first 100 of 105 row errors."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(101);
  });

  it("handles a failed count with no row details", () => {
    view(
      <ImportResultPanel
        result={{ ...partial, failed: 2, errors: null }}
        fileName="vehicles.csv"
        onSearchPlate={vi.fn()}
        onImportAnother={vi.fn()}
        onDownloadErrors={vi.fn()}
      />,
    );
    expect(screen.getByText("No row details were returned.")).toBeInTheDocument();
  });

  it("does not call an empty file an error", () => {
    view(
      <ImportResultPanel
        result={{ job_id: "job-2", total: 0, imported: 0, failed: 0, errors: null }}
        fileName="empty.csv"
        onSearchPlate={vi.fn()}
        onImportAnother={vi.fn()}
        onDownloadErrors={vi.fn()}
      />,
    );
    expect(screen.getByText("No rows to import.")).toBeInTheDocument();
  });
});
