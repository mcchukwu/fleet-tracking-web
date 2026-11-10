import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useLiveSnapshot, useVehicleEvents, useVehicleHistory } from "../../../api/hooks/vehicles";
import { queryKeys } from "../../../api/keys";
import { ErrorBoundary } from "../../../errors/ErrorBoundary";
import { ErrorState } from "../../../errors/ErrorState";
import { useErrorStorm } from "../../../errors/global";
import { normalize } from "../../../errors/normalize";
import { resetPlaybackDebug, setPlaybackDebug } from "../../../dev/debug";
import { MapAttribution } from "../../../map/MapAttribution";
import type { MapAdapter, LngLat, MapRoute } from "../../../map/types";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { spansLocalDays } from "../../../lib/format";
import { useMediaQuery } from "../../../lib/useMediaQuery";
import { useConnection } from "../../../stores/connection";
import { usePlaybackCamera } from "../hooks/usePlaybackCamera";
import { usePlaybackClock } from "../hooks/usePlaybackClock";
import { usePlaybackShortcuts } from "../hooks/usePlaybackShortcuts";
import { usePlaybackUrl } from "../hooks/usePlaybackUrl";
import { findGaps, normalisePoints } from "../lib/history";
import { timelineEvents } from "../lib/events";
import { presetRange, resolutionParam } from "../lib/range";
import { DEFAULT_RANGE_MS, RANGE_PRESETS, type RangePresetId } from "../lib/constants";
import { ChangeVehicleDialog } from "./ChangeVehicleDialog";
import { CustomRangeDialog } from "./CustomRangeDialog";
import { GapAnnouncer } from "./GapAnnouncer";
import { PlaybackControls } from "./PlaybackControls";
import { PlaybackOptions } from "./PlaybackOptions";
import { PlaybackMap } from "./PlaybackMap";
import { PlaybackStates } from "./PlaybackStates";
import { VehiclePicker } from "./VehiclePicker";

const HEADER_FALLBACK = 96;
const CONTROLS_FALLBACK = 180;

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

function useElementHeight(
  ref: RefObject<HTMLElement | null>,
  fallback: number,
): number {
  const [height, setHeight] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height;
      if (typeof next === "number" && next > 0) setHeight(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

export function PlaybackPage() {
  const {
    vehicleId,
    from,
    to,
    resolution,
    range,
    preset,
    setVehicle,
    setRange,
    setResolution,
    useDefaultRange,
  } = usePlaybackUrl();
  const snapshot = useLiveSnapshot();
  const storm = useErrorStorm();
  const { network } = useConnection();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [adapter, setAdapter] = useState<MapAdapter | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLElement>(null);
  const focusedVehicle = useRef<string | null>(null);
  const changeTriggerRef = useRef<HTMLButtonElement>(null);
  const rangeTriggerRef = useRef<HTMLButtonElement>(null);

  const offline = network === "offline";
  const defaulting = !from || !to;
  const requestEnabled = Boolean(vehicleId) && range.valid && !defaulting && !offline;

  const history = useVehicleHistory(
    vehicleId ?? undefined,
    { from, to, resolution: resolutionParam(resolution) },
    { enabled: requestEnabled && !cancelled },
  );
  const eventsQuery = useVehicleEvents(
    vehicleId ?? undefined,
    { from, to },
    { enabled: requestEnabled && !cancelled },
  );

  useDocumentTitle("Playback");

  const rows = snapshot.data ?? [];
  const vehicle = rows.find((row) => row.id === vehicleId) ?? null;
  const points = useMemo(() => normalisePoints(history.data?.data ?? []), [history.data]);
  const routePoints = useMemo<LngLat[]>(
    () => points.map((point) => [point.lon, point.lat]),
    [points],
  );
  const gapResult = useMemo(() => findGaps(points), [points]);
  const fromMs = range.valid ? range.fromMs : 0;
  const toMs = range.valid ? range.toMs : 0;
  const crossDay = range.valid && spansLocalDays(fromMs, toMs);
  const resetKey = `${vehicleId ?? ""}|${from ?? ""}|${to ?? ""}|${resolution}`;

  const clock = usePlaybackClock({
    points,
    gapAfterIndex: gapResult.gapAfterIndex,
    fromMs,
    toMs,
    reducedMotion,
    resetKey,
    enabled: requestEnabled && !cancelled,
  });

  const headerInset = useElementHeight(headerRef, HEADER_FALLBACK);
  const controlsInset = useElementHeight(controlsRef, CONTROLS_FALLBACK);
  const camera = usePlaybackCamera({
    adapter,
    points: routePoints,
    fitKey: clock.fitKey,
    topInset: headerInset,
    bottomInset: controlsInset,
    reducedMotion,
  });

  const timeline = useMemo(
    () => (range.valid ? timelineEvents(eventsQuery.data ?? [], fromMs, toMs) : []),
    [eventsQuery.data, fromMs, range.valid, toMs],
  );

  const route = useMemo<MapRoute | null>(
    () =>
      points.length === 0
        ? null
        : {
            points: routePoints,
            gapAfterIndex: gapResult.gapAfterIndex,
            cursorIndex: clock.cursor.index >= 0 ? clock.cursor.index : null,
            cursorPosition: clock.cursor.position,
            chevrons: true,
          },
    [routePoints, points.length, gapResult.gapAfterIndex, clock.cursor.index, clock.cursor.position],
  );

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a new range re-enables the request after Cancel.
    setCancelled(false);
  }, [resetKey]);

  useEffect(
    () => () => {
      resetPlaybackDebug();
      if (import.meta.env.DEV) window.__FLEET_TEST_MAP__ = null;
    },
    [],
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
      cursorIndex: clock.cursor.index >= 0 ? clock.cursor.index : null,
      cursorPosition: clock.cursor.position,
      playheadMs: range.valid ? clock.playheadMs : null,
      playing: clock.playing,
      speed: clock.speed,
      inGap: clock.cursor.inGap,
      cancelled,
      reducedMotion,
    });
  }, [
    vehicleId,
    from,
    to,
    resolution,
    points.length,
    gapResult.gaps.length,
    timeline.length,
    clock.cursor.index,
    clock.cursor.position,
    clock.cursor.inGap,
    clock.playheadMs,
    clock.playing,
    clock.speed,
    range.valid,
    cancelled,
    reducedMotion,
  ]);

  usePlaybackShortcuts({
    onToggle: clock.toggle,
    onStep: clock.step,
    onSpeed: clock.changeSpeed,
  });

  const cached = points.length > 0;
  const historyError =
    !offline && history.isError ? normalize(history.error, { resource: "history" }) : null;
  const eventsError =
    !offline && eventsQuery.isError
      ? normalize(eventsQuery.error, { resource: "events" })
      : null;

  const cancel = useCallback(() => {
    setCancelled(true);
    clock.pause();
    if (vehicleId) {
      void queryClient.cancelQueries({ queryKey: queryKeys.vehicleHistory(vehicleId, { from, to }) });
      void queryClient.cancelQueries({ queryKey: queryKeys.vehicleEvents(vehicleId, { from, to }) });
    }
  }, [clock, from, queryClient, to, vehicleId]);

  const retryHistory = useCallback(() => {
    setCancelled(false);
    void history.refetch();
  }, [history]);

  const restoreFocus = (ref: { current: HTMLElement | null }) => {
    requestAnimationFrame(() => {
      const target = ref.current;
      if (target && document.contains(target)) target.focus();
    });
  };

  const openChangeVehicle = () => {
    setChangeOpen(true);
  };

  const closeChangeVehicle = () => {
    setChangeOpen(false);
    restoreFocus(changeTriggerRef);
  };

  const openCustomRange = () => {
    setCustomOpen(true);
  };

  const closeCustomRange = () => {
    setCustomOpen(false);
    restoreFocus(rangeTriggerRef);
  };

  useEffect(() => {
    if (!vehicleId) return;
    const destination = `${vehicleId}|${points.length > 0 ? "play" : "loading"}`;
    if (focusedVehicle.current === destination) return;
    focusedVehicle.current = destination;
    requestAnimationFrame(() => {
      if (points.length > 0) {
        const play = controlsRef.current?.querySelector<HTMLButtonElement>(
          '[aria-label="Play"], [aria-label="Pause"]',
        );
        if (play) {
          play.focus();
          return;
        }
      }
      controlsRef.current?.focus();
    });
  }, [vehicleId, points.length]);

  const headerVehicle = vehicle ?? (vehicleId ? { id: vehicleId, plate: "—" } : null);

  let overlay: ReactNode = null;
  if (vehicleId && !defaulting) {
    if (!range.valid) {
      overlay = (
        <PlaybackStates variant="validation" message={range.message} onResetRange={useDefaultRange} />
      );
    } else if (cancelled && !cached) {
      overlay = (
        <PlaybackStates variant="cancelled" onRetry={retryHistory} onResetRange={useDefaultRange} />
      );
    } else if (offline && !cached) {
      overlay = <PlaybackStates variant="offline-uncached" />;
    } else if (historyError && !cached) {
      overlay =
        historyError.kind === "forbidden" ? (
          <PlaybackStates
            variant="forbidden"
            onBack={() => void navigate({ to: "/map", search: { v: vehicleId } })}
          />
        ) : historyError.kind === "not_found" ? (
          <PlaybackStates
            variant="not-found"
            onBack={() => void navigate({ to: "/map", search: { v: vehicleId } })}
          />
        ) : historyError.code === "invalid_range" ? (
          <PlaybackStates
            variant="validation"
            message={historyError.serverMessage}
            onResetRange={useDefaultRange}
          />
        ) : (
          <ErrorState error={historyError} onRetry={retryHistory} compact={storm} />
        );
    } else if (!cached && !history.isPending) {
      overlay = <PlaybackStates variant="empty" onResetRange={useDefaultRange} />;
    }
  }

  return (
    <div data-testid="playback-page" className="relative h-full min-h-0 bg-surface-2">
      <ErrorBoundary level="panel">
        <CrashProbe />
        <PlaybackMap
          route={route}
          offline={offline}
          onReady={(next) => {
            setAdapter(next);
            if (import.meta.env.DEV) window.__FLEET_TEST_MAP__ = next;
          }}
        />
        <GapAnnouncer
          inGap={clock.cursor.inGap}
          playheadMs={clock.playheadMs}
          gaps={gapResult.gaps}
          includeDate={crossDay}
        />

        {headerVehicle ? (
          <div ref={headerRef} className="pointer-events-none absolute inset-x-3 top-3 z-20">
            <PlaybackOptions
              vehicle={headerVehicle}
              offline={offline}
              savedAt={history.dataUpdatedAt}
              preset={preset}
              resolution={resolution}
              responseResolution={history.data?.resolution ?? null}
              pointCount={points.length}
              cursor={clock.cursor}
              events={timeline}
              includeDate={crossDay}
              eventsError={eventsError}
              onPreset={(id) => {
                const option = presetRange(presetMs(id));
                setRange(option.from, option.to);
              }}
              onCustomRange={openCustomRange}
              onResolution={setResolution}
              onFit={camera.fit}
              onJump={clock.seek}
              onEventsRetry={() => void eventsQuery.refetch()}
              onChangeVehicle={openChangeVehicle}
              changeTriggerRef={changeTriggerRef}
              rangeTriggerRef={rangeTriggerRef}
              className="pointer-events-auto"
            />
          </div>
        ) : (
          <h1 className="sr-only">Playback</h1>
        )}

        {!vehicleId ? (
          <div className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto p-4 pt-16">
            <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-float">
              <h2 className="text-md font-medium text-text">Choose a vehicle</h2>
              <p className="mt-1 text-sm text-muted">Search by plate or IMEI.</p>
              <div className="mt-3">
                <VehiclePicker value={null} initialFocus onChange={(id) => setVehicle(id)} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col">
          {overlay ? (
            <div className="pointer-events-auto flex justify-center px-3 pb-2">
              <div className="w-full max-w-md">{overlay}</div>
            </div>
          ) : null}
          <div className="pointer-events-none flex justify-end px-3 pb-1">
            <MapAttribution styleId="standard" attribution={null} />
          </div>
          {vehicleId && !defaulting && range.valid ? (
            <PlaybackControls
              controlsRef={controlsRef}
              fromMs={fromMs}
              toMs={toMs}
              playheadMs={clock.playheadMs}
              playing={clock.playing}
              speed={clock.speed}
              cursor={clock.cursor}
              pointCount={points.length}
              gaps={gapResult.gaps}
              events={timeline}
              loading={history.isPending && !cached}
              refreshing={history.isFetching && cached}
              error={cached ? historyError : null}
              disabled={cancelled}
              onToggle={clock.toggle}
              onStep={clock.step}
              onSeek={clock.seek}
              onSpeedChange={clock.setSpeed}
              onRetry={retryHistory}
              onCancel={cancel}
              className="pointer-events-auto"
            />
          ) : null}
        </div>

        {vehicleId ? (
          <ChangeVehicleDialog
            open={changeOpen}
            value={vehicleId}
            onChange={(id) => setVehicle(id)}
            onClose={closeChangeVehicle}
          />
        ) : null}

        {from && to ? (
          <CustomRangeDialog
            open={customOpen}
            from={from}
            to={to}
            onApply={(nextFrom, nextTo) => {
              setRange(nextFrom, nextTo);
              closeCustomRange();
            }}
            onClose={closeCustomRange}
          />
        ) : null}
      </ErrorBoundary>
    </div>
  );
}

function presetMs(id: RangePresetId): number {
  return RANGE_PRESETS.find((preset) => preset.id === id)?.ms ?? DEFAULT_RANGE_MS;
}
