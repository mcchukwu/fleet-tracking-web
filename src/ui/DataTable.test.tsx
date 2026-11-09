import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DATA_TABLE_ROW_HEIGHT,
  DataTable,
  type DataTableColumn,
} from "./DataTable";

interface Row {
  id: string;
  plate: string;
  speed: number;
}

const rows: Row[] = [
  { id: "a", plate: "LSD-101-AA", speed: 62 },
  { id: "b", plate: "LSD-102-AA", speed: 48 },
];

const columns: DataTableColumn<Row>[] = [
  {
    id: "plate",
    header: "Plate",
    width: 160,
    cell: (row) => row.plate,
    title: (row) => row.plate,
  },
  {
    id: "speed",
    header: "Speed",
    width: 100,
    align: "right",
    cell: (row) => `${row.speed} km/h`,
    sortable: true,
  },
  {
    id: "actions",
    header: "Actions",
    width: 80,
    align: "right",
    cell: () => null,
  },
];

describe("DataTable", () => {
  it("renders the header and cells from one column definition", () => {
    render(
      <DataTable
        label="Vehicles"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
      />,
    );

    expect(screen.getByRole("table", { name: "Vehicles" })).toHaveClass(
      "table-fixed",
    );
    expect(screen.getByRole("columnheader", { name: "Plate" })).toHaveAttribute(
      "data-column-id",
      "plate",
    );
    expect(screen.getByRole("cell", { name: "LSD-101-AA" })).toHaveAttribute(
      "data-column-id",
      "plate",
    );
  });

  it("keeps text left and measures right", () => {
    render(
      <DataTable
        label="Vehicles"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Plate" })).toHaveClass(
      "text-left",
    );
    expect(screen.getByRole("columnheader", { name: "Speed" })).toHaveClass(
      "text-right",
    );
    const speed = screen.getByRole("cell", { name: "62 km/h" });
    expect(speed).toHaveClass("text-right");
    expect(speed).toHaveClass("tabular-nums");
  });

  it("uses a fixed row height and a 12px inset in every cell", () => {
    render(
      <DataTable
        label="Vehicles"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
      />,
    );

    expect(DATA_TABLE_ROW_HEIGHT).toBe(36);
    for (const cell of screen.getAllByRole("cell")) {
      expect(cell).toHaveClass("h-row");
      expect(cell).toHaveClass("px-3");
    }
    for (const row of screen.getAllByRole("row").slice(1)) {
      expect(row).toHaveClass("h-row");
    }
  });

  it("truncates by default and keeps the full value in the title", () => {
    render(
      <DataTable
        label="Vehicles"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
      />,
    );

    const cell = screen.getByRole("cell", { name: "LSD-101-AA" });
    expect(cell).toHaveAttribute("title", "LSD-101-AA");
    expect(cell.querySelector("[data-cell-content]")).toHaveClass(
      "overflow-hidden",
    );
    expect(cell.querySelector("[data-cell-content]")).toHaveClass(
      "text-ellipsis",
    );
    expect(cell.querySelector("[data-cell-content]")).toHaveClass(
      "whitespace-nowrap",
    );
  });

  it("does not truncate a column that declares truncate false", () => {
    const fullWidth = columns.map((column) =>
      column.id === "plate" ? { ...column, truncate: false } : column,
    );
    render(
      <DataTable
        label="Vehicles"
        columns={fullWidth}
        rows={rows}
        rowKey={(row) => row.id}
      />,
    );

    const content = screen
      .getByRole("cell", { name: "LSD-101-AA" })
      .querySelector("[data-cell-content]");
    expect(content).toHaveClass("whitespace-nowrap");
    expect(content).not.toHaveClass("overflow-hidden");
  });

  it("sorts a sortable column and reports aria-sort", async () => {
    const onSort = vi.fn();
    render(
      <DataTable
        label="Vehicles"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={{ columnId: "speed", direction: "asc" }}
        onSort={onSort}
      />,
    );

    const header = screen.getByRole("columnheader", { name: /Speed/ });
    expect(header).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(screen.getByRole("button", { name: /Speed/ }));
    expect(onSort).toHaveBeenCalledWith("speed");
  });

  it("renders spacer rows for a virtualised body", () => {
    const { container } = render(
      <DataTable
        label="Vehicles"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        topSpacer={72}
        bottomSpacer={36}
      />,
    );

    expect(container.querySelectorAll("tbody tr")).toHaveLength(
      rows.length + 2,
    );
  });
});
