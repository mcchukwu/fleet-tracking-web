import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { ReportSummary } from "../../../api/types";
import { formatCount, formatDistanceCompact } from "../../../lib/format";
import { Stat } from "../../../ui/Stat";
import { reportsCopy } from "../lib/copy";
import {
  completionHint,
  fleetTotalHint,
  statDestination,
  type StatDestination,
  type StatId,
} from "../lib/stats";

interface Cell {
  id: StatId;
  label: string;
  value: string;
  hint?: string;
}

function cells(summary: ReportSummary): Cell[] {
  return [
    {
      id: "vehicles",
      label: "Vehicles",
      value: formatCount(summary.vehicles),
      hint: fleetTotalHint(),
    },
    { id: "trips", label: "Trips", value: formatCount(summary.trips) },
    {
      id: "completedTrips",
      label: "Completed trips",
      value: formatCount(summary.completed_trips),
      hint: completionHint(summary.trips, summary.completed_trips),
    },
    {
      id: "activeTrips",
      label: "Active trips",
      value: formatCount(summary.active_trips),
    },
    { id: "alerts", label: "Alerts", value: formatCount(summary.alerts) },
    {
      id: "openAlerts",
      label: "Open alerts",
      value: formatCount(summary.open_alerts),
    },
    {
      id: "distance",
      label: "Distance",
      value: formatDistanceCompact(summary.distance_km),
    },
  ];
}

function DestinationLink({
  destination,
  statId,
  children,
}: {
  destination: StatDestination;
  statId: StatId;
  children: ReactNode;
}) {
  const className =
    "bg-surface hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring block";
  switch (destination.to) {
    case "/map":
      return (
        <Link to="/map" search={{}} data-stat-id={statId} className={className}>
          {children}
        </Link>
      );
    case "/trips":
      return (
        <Link
          to="/trips"
          search={destination.search ?? {}}
          data-stat-id={statId}
          className={className}
        >
          {children}
        </Link>
      );
    case "/alerts":
      return (
        <Link
          to="/alerts"
          search={destination.search ?? {}}
          data-stat-id={statId}
          className={className}
        >
          {children}
        </Link>
      );
  }
}

export function ReportsStats({ summary }: { summary: ReportSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        data-testid="reports-stats"
        className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-7"
      >
        {cells(summary).map((cell) => {
          const stat = (
            <Stat
              label={cell.label}
              value={cell.value}
              hint={cell.hint}
              className="bg-surface min-h-28 border-0"
            />
          );
          const destination = statDestination(cell.id);
          return destination ? (
            <DestinationLink
              key={cell.id}
              destination={destination}
              statId={cell.id}
            >
              {stat}
            </DestinationLink>
          ) : (
            <div key={cell.id} data-stat-id={cell.id}>
              {stat}
            </div>
          );
        })}
      </div>
      <p className="text-muted text-xs">{reportsCopy.rangeNote}</p>
    </div>
  );
}
