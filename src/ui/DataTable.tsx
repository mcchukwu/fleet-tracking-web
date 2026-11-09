import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  Ref,
  UIEvent,
} from "react";
import { cn } from "./cn";

export const DATA_TABLE_ROW_HEIGHT = 36;

export type DataTableAlign = "left" | "right";

export interface DataTableColumn<Row> {
  id: string;
  header: ReactNode;
  width: number;
  align?: DataTableAlign;
  cell: (row: Row, index: number) => ReactNode;
  sortable?: boolean;
  title?: (row: Row, index: number) => string | null | undefined;
  truncate?: boolean;
}

export interface DataTableSort {
  columnId: string;
  direction: "asc" | "desc";
}

export interface DataTableProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row, index: number) => string;
  label: string;
  className?: string;
  rowHeight?: number;
  topSpacer?: number;
  bottomSpacer?: number;
  sort?: DataTableSort | null;
  onSort?: (columnId: string) => void;
  selected?: (row: Row, index: number) => boolean;
  rowProps?: (
    row: Row,
    index: number,
  ) => HTMLAttributes<HTMLTableRowElement> & { ref?: Ref<HTMLTableRowElement> };
  renderRow?: (
    row: Row,
    index: number,
    cells: readonly ReactNode[],
  ) => ReactNode | undefined;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  onScrollerChange?: (element: HTMLDivElement | null) => void;
}

function tableStyle(totalWidth: number): CSSProperties {
  return { minWidth: totalWidth };
}

function colStyle(width: number): CSSProperties {
  return { width };
}

function spacerStyle(height: number): CSSProperties {
  return { height };
}

function mergedStyle(
  base: CSSProperties | undefined,
  extra: CSSProperties | undefined,
): CSSProperties | undefined {
  if (!base && !extra) return undefined;
  return { ...base, ...extra };
}

function alignClass(align: DataTableAlign | undefined): string {
  return align === "right" ? "text-right" : "text-left";
}

function SortGlyph({ direction }: { direction: "asc" | "desc" | null }) {
  if (direction === "asc") {
    return <ArrowUp aria-hidden="true" className="size-3" strokeWidth={1.5} />;
  }
  if (direction === "desc") {
    return (
      <ArrowDown aria-hidden="true" className="size-3" strokeWidth={1.5} />
    );
  }
  return (
    <ArrowUpDown aria-hidden="true" className="size-3" strokeWidth={1.5} />
  );
}

function SpacerRow({ height, columns }: { height: number; columns: number }) {
  return (
    <tr aria-hidden="true">
      <td
        aria-hidden="true"
        colSpan={columns}
        className="p-0"
        style={spacerStyle(height)}
      />
    </tr>
  );
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  label,
  className,
  rowHeight = DATA_TABLE_ROW_HEIGHT,
  topSpacer = 0,
  bottomSpacer = 0,
  sort = null,
  onSort,
  selected,
  rowProps,
  renderRow,
  onScroll,
  onScrollerChange,
}: DataTableProps<Row>) {
  const totalWidth = columns.reduce((total, column) => total + column.width, 0);
  const rowStyle =
    rowHeight === DATA_TABLE_ROW_HEIGHT ? undefined : { height: rowHeight };
  const stickyFirst = columns.length > 0;

  function scrollerRef(element: HTMLDivElement | null): void {
    onScrollerChange?.(element);
  }

  return (
    <div data-data-table className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={scrollerRef}
        data-data-table-scroll
        className="border-border bg-surface min-h-0 flex-1 overflow-auto rounded-lg border"
        onScroll={onScroll}
      >
        <table
          aria-label={label}
          className="w-full table-fixed border-collapse text-sm"
          style={tableStyle(totalWidth)}
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column.id} style={colStyle(column.width)} />
            ))}
          </colgroup>
          <thead className="bg-surface-2 sticky top-0 z-20">
            <tr className="h-row border-border border-b" style={rowStyle}>
              {columns.map((column, index) => {
                const direction =
                  sort?.columnId === column.id ? sort.direction : null;
                const sortable = Boolean(column.sortable && onSort);
                return (
                  <th
                    key={column.id}
                    scope="col"
                    data-column-id={column.id}
                    aria-sort={
                      sortable
                        ? direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                    className={cn(
                      "label-caps h-row border-border text-muted border-b px-3 py-0 align-middle whitespace-nowrap",
                      alignClass(column.align),
                      stickyFirst &&
                        index === 0 &&
                        "bg-surface-2 sticky left-0 z-30",
                    )}
                    style={rowStyle}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(column.id)}
                        className="focus-visible:outline-focus-ring inline-flex items-center gap-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-0"
                      >
                        {column.header}
                        <SortGlyph direction={direction} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {topSpacer > 0 ? (
              <SpacerRow height={topSpacer} columns={columns.length} />
            ) : null}
            {rows.map((row, index) => {
              const isSelected = selected?.(row, index) ?? false;
              const cells = columns.map((column, cellIndex) => (
                <td
                  key={column.id}
                  data-column-id={column.id}
                  title={column.title?.(row, index) ?? undefined}
                  className={cn(
                    "h-row text-text px-3 py-0 align-middle text-sm whitespace-nowrap",
                    alignClass(column.align),
                    column.align === "right" && "tabular-nums",
                    stickyFirst &&
                      cellIndex === 0 &&
                      "sticky left-0 z-10 bg-inherit",
                    isSelected &&
                      cellIndex === 0 &&
                      "ring-accent ring-2 ring-inset",
                  )}
                  style={rowStyle}
                >
                  <div
                    data-cell-content
                    data-truncate={column.truncate === false ? "false" : "true"}
                    className={cn(
                      "whitespace-nowrap",
                      column.truncate === false
                        ? undefined
                        : "overflow-hidden text-ellipsis",
                    )}
                  >
                    {column.cell(row, index)}
                  </div>
                </td>
              ));

              const custom = renderRow?.(row, index, cells);
              if (custom !== undefined) return custom;

              const rowAttributes = rowProps?.(row, index);
              return (
                <tr
                  key={rowKey(row, index)}
                  data-row="data"
                  {...rowAttributes}
                  className={cn(
                    "h-row border-border bg-surface hover:bg-surface-2 border-b transition-colors duration-100",
                    isSelected && "bg-accent-soft",
                    rowAttributes?.className,
                  )}
                  style={mergedStyle(rowStyle, rowAttributes?.style)}
                >
                  {cells}
                </tr>
              );
            })}
            {bottomSpacer > 0 ? (
              <SpacerRow height={bottomSpacer} columns={columns.length} />
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
