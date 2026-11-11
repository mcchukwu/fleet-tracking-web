/* oxlint-disable jsx-a11y/prefer-tag-over-role -- the chart carries visible labels and values, so <img> cannot replace it. */
import { useId } from "react";
import { formatCount } from "../../../lib/format";
import type { DataTableColumn } from "../../../ui/DataTable";
import { DataTable } from "../../../ui/DataTable";
import { EmptyState } from "../../../ui/StatePanel";
import { chartDescription, chartItems, chartState, type ChartItem } from "../lib/chart";
import type { AlertTypeCount } from "../lib/chart";
import { reportsCopy } from "../lib/copy";

const columns: DataTableColumn<ChartItem>[] = [
  {
    id: "type",
    header: "Type",
    width: 220,
    cell: (item) => item.label,
    title: (item) => item.label,
  },
  {
    id: "count",
    header: "Alerts",
    width: 88,
    align: "right",
    cell: (item) => formatCount(item.count),
  },
];

export interface AlertsByTypeChartProps {
  items: readonly AlertTypeCount[];
  alertCount: number;
}

export function AlertsByTypeChart({ items, alertCount }: AlertsByTypeChartProps) {
  const headingId = useId();
  const descriptionId = useId();
  const visible = chartItems(items);
  const state = chartState(alertCount, visible);

  return (
    <section
      aria-labelledby={headingId}
      data-testid="alerts-by-type"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <h2 id={headingId} className="text-md text-text font-medium">
        Alerts by type
      </h2>

      {state === "empty" ? (
        <EmptyState
          title={reportsCopy.alertsEmpty.title}
          description={reportsCopy.alertsEmpty.description}
        />
      ) : null}

      {state === "missing" ? (
        <p className="text-muted text-sm">{reportsCopy.breakdownUnavailable}</p>
      ) : null}

      {state === "ready" ? (
        <>
          <div
            role="img"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            className="flex flex-col gap-1.5"
          >
            <p id={descriptionId} className="sr-only">
              {chartDescription(visible)}
            </p>
            {visible.map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <span
                  data-testid="chart-label"
                  title={item.label}
                  className="text-text w-32 shrink-0 truncate text-sm"
                >
                  {item.label}
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                  className="h-2 min-w-0 flex-1"
                >
                  <rect x="0" y="0" width="100" height="8" className="fill-surface-2" />
                  <rect
                    x="0"
                    y="0"
                    width={(item.count / (visible[0]?.count ?? 1)) * 100}
                    height="8"
                    className="fill-accent"
                  />
                </svg>
                <span className="text-text w-14 shrink-0 text-right text-sm tabular-nums">
                  {formatCount(item.count)}
                </span>
              </div>
            ))}
          </div>

          <details className="border-border border-t pt-2">
            <summary className="text-text flex min-h-touch cursor-pointer items-center text-sm font-medium md:min-h-control-sm">
              View data table
            </summary>
            <div className="mt-2">
              <DataTable
                columns={columns}
                rows={visible}
                rowKey={(item) => item.key}
                label="Alerts by type"
              />
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}
