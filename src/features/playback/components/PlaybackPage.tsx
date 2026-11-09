import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLiveSnapshot, useVehicleEvents, useVehicleHistory } from "../../../api/hooks/vehicles";
import { ErrorBoundary } from "../../../errors/ErrorBoundary";
import { ErrorState } from "../../../errors/ErrorState";
import { normalize } from "../../../errors/normalize";
import { resetPlaybackDebug, setPlaybackDebug } from "../../../dev/debug";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useMediaQuery } from "../../../lib/useMediaQuery";
import { useConnection } from "../../../stores/connection";
import { Button } from "../../../ui/Button";
import { LoadingBar } from "../../../ui/StatePanel";
import { usePlaybackUrl } from "../hooks/usePlaybackUrl";
import { cursorAt, findGaps, normalisePoints } from "../lib/history";
import { timelineEvents } from "../lib/events";
import { resolutionParam } from "../lib/range";
import { ChangeVehicleDialog } from "./ChangeVehicleDialog";
import { PlaybackHeader } from "./PlaybackHeader";
import { PlaybackStates } from "./PlaybackStates";
import { VehiclePicker } from "./VehiclePicker";

function crashRequested(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("crash") === "playback"
  );
}

function CrashProbe(): null {
  if (crashRequested()) throw new Error("Injected playback crash");
  return null;
}

export function PlaybackPage() {
  const {
    vehicleId,
    from,
    to,
    resolution,
    range,
    setVehicle,
    useDefaultRange,
  } = usePlaybackUrl();
  const snapshot = useLiveSnapshot();
  const { network } = useConnection();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [changeOpen, setChangeOpen] = useState(false);

  const offline = network === "offline";
  const defaulting = !from || !to;
  const requestEnabled = Boolean(vehicleId) && range.valid && !defaulting;

  const history = useVehicleHistory(
    vehicleId ?? undefined,
    {
      from,
      to,
      resolution: resolutionParam(resolution),
    },
    { enabled: requestEnabled },
  );
  const eventsQuery = useVehicleEvents(
    vehicleId ?? undefined,
    { from, to },
    { enabled: requestEnabled },
  );

  useDocumentTitle("Playback");

  const rows = snapshot.data ?? [];
  const vehicle = rows.find((row) => row.id === vehicleId) ?? null;
  const points = useMemo(
    () => normalisePoints(history.data?.data ?? []),
    [history.data],
  );
  const gapResult = useMemo(() => findGaps(points), [points]);
  const fromMs = range.valid ? range.fromMs : 0;
  const toMs = range.valid ? range.toMs : 0;
  const timeline = useMemo(
    () => (range.valid ? timelineEvents(eventsQuery.data ?? [], fromMs, toMs) : []),
    [eventsQuery.data, fromMs, range.valid, toMs],
  );
  const cursor = useMemo(
    () => cursorAt(points, fromMs, gapResult.gapAfterIndex, reducedMotion),
    [points, fromMs, gapResult.gapAfterIndex, reducedMotion],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setPlaybackDebug({
      vehicleId,
      from: from ?? null,
      to: to ?? null,
      resolution,
      pointCount: points.length,
      gapCount: gapResult.gaps.length,
      eventCount: timeline.length,
      cursorIndex: cursor.index >= 0 ? cursor.index : null,
      cursorPosition: cursor.position,
      playheadMs: range.valid ? fromMs : null,
      playing: false,
      speed: 1,
      inGap: cursor.inGap,
      cancelled: false,
      reducedMotion,
    });
    return () => resetPlaybackDebug();
  }, [
    vehicleId,
    from,
    to,
    resolution,
    points.length,
    gapResult.gaps.length,
    timeline.length,
    cursor.index,
    cursor.position,
    cursor.inGap,
    range.valid,
    fromMs,
    reducedMotion,
  ]);

  const cached = points.length > 0;
  const historyError =
    !offline && history.isError ? normalize(history.error, { resource: "history" }) : null;
  const eventsError =
    !offline && eventsQuery.isError
      ? normalize(eventsQuery.error, { resource: "events" })
      : null;

  const headerVehicle = vehicle ?? (vehicleId ? { id: vehicleId, plate: "—" } : null);

  let overlay: ReactNode = null;
  if (vehicleId && !defaulting) {
    if (!range.valid) {
      overlay = (
        <PlaybackStates
          variant="validation"
          message={range.message}
          onResetRange={useDefaultRange}
        />
      );
    } else if (offline && !cached && !history.isPending) {
      overlay = <PlaybackStates variant="offline-uncached" />;
    } else if (history.isPending && !cached) {
      overlay = (
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4">
          <LoadingBar label="Loading playback" />
        </div>
      );
    } else if (historyError && !cached) {
      overlay =
        historyError.kind === "forbidden" ? (
          <PlaybackStates variant="forbidden" />
        ) : historyError.kind === "not_found" ? (
          <PlaybackStates variant="not-found" />
        ) : (
          <ErrorState error={historyError} onRetry={() => void history.refetch()} />
        );
    } else if (!cached && !history.isPending) {
      overlay = <PlaybackStates variant="empty" onResetRange={useDefaultRange} />;
    }
  }

  return (
    <div data-testid="playback-page" className="relative h-full min-h-0 bg-surface-2">
      <ErrorBoundary level="panel">
        <CrashProbe />
        {headerVehicle ? (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex">
            <PlaybackHeader
              vehicle={headerVehicle}
              offline={offline}
              onChangeVehicle={() => setChangeOpen(true)}
              className="pointer-events-auto w-full max-w-lg"
            />
          </div>
        ) : (
          <h1 className="sr-only">Playback</h1>
        )}

        <section aria-label="Playback map" className="absolute inset-0" />

        {!vehicleId ? (
          <div className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto p-4 pt-16">
            <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-float">
              <h2 className="text-md font-medium text-text">Choose a vehicle</h2>
              <p className="mt-1 text-sm text-muted">Search by plate or IMEI.</p>
              <div className="mt-3">
                <VehiclePicker
                  value={null}
                  initialFocus
                  onChange={(id) => setVehicle(id)}
                />
              </div>
            </div>
          </div>
        ) : overlay ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-24 z-10 flex justify-center">
            <div className="pointer-events-auto w-full max-w-md">{overlay}</div>
          </div>
        ) : null}

        {!vehicleId ? null : eventsError ? (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-float">
            <span className="text-muted">Events unavailable</span>
            <Button size="sm" variant="ghost" onClick={() => void eventsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        {changeOpen && vehicleId ? (
          <ChangeVehicleDialog
            open
            value={vehicleId}
            onChange={(id) => setVehicle(id)}
            onClose={() => setChangeOpen(false)}
          />
        ) : null}
      </ErrorBoundary>
    </div>
  );
}
