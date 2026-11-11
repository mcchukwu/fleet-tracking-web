import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImportErrorTable } from "./ImportErrorTable";

const errors = Array.from({ length: 100 }, (_, index) => ({
  row: index + 2,
  message: `Row ${index + 2} has an invalid year`,
}));

describe("ImportErrorTable", () => {
  it("renders every returned row, the cap notice and the header-line hint", async () => {
    const onDownload = vi.fn();
    render(
      <ImportErrorTable errors={errors} failed={105} onDownload={onDownload} />,
    );

    expect(
      screen.getByRole("table", { name: "Row errors" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(101);
    expect(
      screen.getByText("Showing the first 100 of 105 row errors."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Row numbers include the header line."),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Download errors as CSV" }),
    );
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("does not claim a cap when every failure is shown", () => {
    render(
      <ImportErrorTable
        errors={errors.slice(0, 2)}
        failed={2}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText("2 row errors.")).toBeInTheDocument();
  });
});
