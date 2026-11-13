import { MapPin, Play } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { Alert, Geofence } from "../../../api/types";
import { ErrorState } from "../../../errors/ErrorState";
import { InlineError } from "../../../errors/InlineError";
import type { AppError } from "../../../errors/types";
import { formatCoordinates } from "../../../lib/format";
import {
  alertStatusLabels,
  alertTypeLabel,
  isAlertSeverity,
  isAlertStatus,
} from "../../../lib/status";
import { AlertStatusBadge, Badge, SeverityBadge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import { Drawer } from "../../../ui/Drawer";
import { Skeleton } from "../../../ui/StatePanel";
import { Timestamp } from "../../../ui/Timestamp";
import { useAlertPosition } from "../hooks/useAlertPosition";
import type { AckErrorState } from "../hooks/useAlertAck";
import { geofenceForAlert, positionSourceLabel } from "../lib/position";
import { replaySearch } from "../lib/replay";
import { AlertAckButton } from "./AlertAckButton";
import { AlertEvidenceSection } from "./AlertEvidenceSection";
import { AlertPositionMap } from "./AlertPositionMap";
import { AlertTripSection } from "./AlertTripSection";

export type AlertLookupState = "loading" | "ready" | "not-found" | "error" | "offline";

export interface AlertDetailPanelProps {
  alert: Alert | null;
  lookup: AlertLookupState;
  lookupError?: AppError | null;
  geofences: readonly Geofence[];
  offline?: boolean;
  pending: boolean;
  disabledReason?: string;
  ackError?: AckErrorState | null;
  onClose: () => void;
  onAck: () => void;
  onRetryLookup: () => void;
  returnFocus?: () => void;
}

export function AlertDetailPanel(props: AlertDetailPanelProps) {
  if (!props.alert) return <MissingAlertPanel {...props} />;
  return <ResolvedAlertDetail {...props} alert={props.alert} />;
}

function MissingAlertPanel({
  lookup,
  lookupError,
  onClose,
  onRetryLookup,
  returnFocus,
}: AlertDetailPanelProps) {
  return (
    <Drawer
      open
      placement="page"
      label="Alert details"
      title="Alert"
      closeLabel="Close alert details"
      onClose={onClose}
      returnFocus={returnFocus}
    >
      {lookup === "loading" ? (
        <div aria-busy="true" aria-label="Loading alert" className="space-y-3 p-4">
          <Skeleton className="w-2/3" />
          <Skeleton className="w-1/2" />
          <Skeleton className="w-full" />
        </div>
      ) : lookup === "error" && lookupError ? (
        <ErrorState error={lookupError} onRetry={onRetryLookup} className="py-8" />
      ) : lookup === "offline" ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-text text-base font-medium">Alert isn't available offline</p>
          <p className="text-muted text-sm">Reconnect to load this alert.</p>
          <Button size="sm" onClick={onClose}>
            Back to alerts
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-text text-base font-medium">Alert not found</p>
          <p className="text-muted text-sm">It may have been removed.</p>
          <Button size="sm" onClick={onClose}>
            Back to alerts
          </Button>
        </div>
      )}
    </Drawer>
  );
}

function ResolvedAlertDetail({
  alert,
  geofences,
  offline = false,
  pending,
  disabledReason,
  ackError,
  onClose,
  onAck,
  returnFocus,
}: AlertDetailPanelProps & { alert: Alert }) {
  const navigate = useNavigate();
  const position = useAlertPosition(alert, geofences);
  const replay = replaySearch(alert.vehicle_id, alert.occurred_at);

  const severity = isAlertSeverity(alert.severity) ? (
    <SeverityBadge level={alert.severity} />
  ) : (
    <Badge tone="neutral">Unknown severity: {alert.severity}</Badge>
  );
  const status = isAlertStatus(alert.status) ? (
    <AlertStatusBadge status={alert.status} />
  ) : (
    <Badge tone="neutral">Unknown status: {alert.status}</Badge>
  );

  const positionState = position.state;
  const geofence = geofenceForAlert(alert.evidence, geofences);
  const geofenceId = alert.evidence.geofence_id;
  const zoneLabel = geofence
    ? geofence.name
    : typeof geofenceId === "string"
      ? "Unknown zone"
      : "—";

  return (
    <Drawer
      open
      placement="page"
      label="Alert details"
      title={alertTypeLabel(alert.type)}
      titleClassName="font-sans"
      closeLabel="Close alert details"
      headerAside={
        <span className="flex items-center gap-1">
          {severity}
          {status}
        </span>
      }
      actions={
        <>
          {alert.status === "open" ? (
            <AlertAckButton
              alert={alert}
              pending={pending}
              disabledReason={disabledReason}
              onAck={onAck}
            />
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<MapPin aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
            onClick={() => void navigate({ to: "/map", search: { v: alert.vehicle_id } })}
          >
            Open on map
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!replay}
            leadingIcon={<Play aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
            onClick={() => {
              if (!replay) return;
              void navigate({ to: "/playback", search: replay });
            }}
          >
            Replay last 30 minutes
          </Button>
        </>
      }
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <div className="flex flex-col gap-4 p-4">
        {ackError?.alertId === alert.id ? (
          <InlineError
            error={ackError.error}
            copy={{ title: ackError.title, detail: ackError.detail }}
            onRetry={disabledReason ? undefined : onAck}
          />
        ) : null}

        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-2 text-xs">
          <dt className="text-muted">Plate</dt>
          <dd>
            <CopyButton inline value={alert.plate} label="plate" className="text-xs" />
          </dd>

          <dt className="text-muted">Alert id</dt>
          <dd className="min-w-0">
            <CopyButton inline value={alert.id} label="alert id" className="text-xs break-all" />
          </dd>

          <dt className="text-muted">Occurred</dt>
          <dd>
            <Timestamp iso={alert.occurred_at} className="text-xs" />
          </dd>

          {alert.acked_at ? (
            <>
              <dt className="text-muted">Acknowledged</dt>
              <dd className="text-text">
                <Timestamp iso={alert.acked_at} className="text-xs" />
              </dd>
            </>
          ) : null}

          <dt className="text-muted">Status</dt>
          <dd className="text-text">
            {isAlertStatus(alert.status) ? alertStatusLabels[alert.status] : alert.status}
          </dd>

          <dt className="text-muted">Zone</dt>
          <dd className="text-text">{zoneLabel}</dd>
        </dl>

        <section aria-labelledby="alert-position-heading" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id="alert-position-heading" className="text-text text-sm font-medium">
              Position
            </h3>
            <span className="text-muted text-xs">
              {position.state.status === "evidence"
                ? positionSourceLabel("evidence")
                : position.state.status === "history"
                  ? positionSourceLabel("history", position.state.point.t)
                  : "—"}
            </span>
          </div>
          <AlertPositionMap
            alert={alert}
            state={position.state}
            geofence={geofence}
            offline={offline}
            onRetry={position.retry}
          />
          {positionState.status === "evidence" || positionState.status === "history" ? (
            <CopyButton
              value={formatCoordinates(positionState.position.lat, positionState.position.lon)}
              label="coordinates"
              className="text-muted self-start text-xs"
            />
          ) : null}
        </section>

        <section aria-labelledby="alert-trip-heading" className="flex flex-col gap-2">
          <h3 id="alert-trip-heading" className="text-text text-sm font-medium">
            Trip
          </h3>
          <AlertTripSection
            {...(alert.trip_id ? { tripId: alert.trip_id } : {})}
            offline={offline}
          />
        </section>

        <div className="border-border border-t pt-4">
          <AlertEvidenceSection evidence={alert.evidence} />
        </div>
      </div>
    </Drawer>
  );
}
