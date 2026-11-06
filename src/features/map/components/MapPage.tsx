import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useOpenAlerts, OPEN_ALERT_LIMIT } from "../../../api/hooks/alerts";
import { useGeofences } from "../../../api/hooks/geofences";
import { useLiveSnapshot } from "../../../api/hooks/vehicles";
import { queryKeys } from "../../../api/keys";
import { useAuthStore } from "../../../auth/store";
import { errorCopy } from "../../../errors/catalog";
import { ErrorBoundary } from "../../../errors/ErrorBoundary";
import { normalize } from "../../../errors/normalize";
import { formatAgeSeconds, formatClockTime, formatNumber } from "../../../lib/format";
import { STALE_AFTER_MS } from "../../../lib/status";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useMediaQuery } from "../../../lib/useMediaQuery";
import { readMapDebug, setMapDebug } from "../../../dev/debug";
import { mapConfig } from "../../../map/config";
import type { Bounds, MapAdapter } from "../../../map/types";
import { useConnection } from "../../../stores/connection";
import { useToast } from "../../../ui/Toast";
import { cn } from "../../../ui/cn";
import { useMapData } from "../hooks/useMapData";
import { useMapPreferences } from "../hooks/useMapPreferences";
import { useMapShortcuts } from "../hooks/useMapShortcuts";
import { openAlertCountLabel } from "../lib/alerts";
import {
  MAP_ROW_HEIGHT,
  MAP_ROW_HEIGHT_TOUCH,
  SOCKET_STALE_GRACE_MS,
} from "../lib/constants";
import {
  filterRows,
  filterSignature,
  parseStatuses,
  serializeStatuses,
  sortRows,
  type MapFilterValues,
} from "../lib/filter";
import { mapFreshness } from "../lib/freshness";
import { toMapGeofences } from "../lib/geofences";
import { fitPadding, type SheetSnap } from "../lib/padding";
import { KpiStrip, type KpiCell } from "./KpiStrip";
import { MapControls } from "./MapControls";
import { MapView } from "./MapView";
import { MobileVehicleSheet } from "./MobileVehicleSheet";
import { VehiclePanel, type VehiclePanelProps } from "./VehiclePanel";

export function MapPage() {
  const search = useSearch({ from: "/_app/map" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const authenticated = useAuthStore((state) => state.status === "authenticated");
  const snapshotQuery = useLiveSnapshot(authenticated);
  const {
    data: geofences,
    isError: geofencesFailed,
    error: geofencesCause,
    refetch: refetchGeofences,
  } = useGeofences(authenticated);
  const alertsQuery = useOpenAlerts(authenticated);
  const preferences = useMapPreferences();
  const { network, socket, socketDownAt, lastDataAt } = useConnection();
  const { toast } = useToast();

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [loadingCancelled, setLoadingCancelled] = useState(false);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  const adapterRef = useRef<MapAdapter | null>(null);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const fittedOnce = useRef(false);

  const filters: MapFilterValues = useMemo(
    () => ({
      q: search.q?.trim() ?? "",
      statuses: parseStatuses(search.status),
      depot: search.depot ?? null,
      sort: search.sort ?? "plate",
      onlyInView: search.view === 1,
    }),
    [search.q, search.status, search.depot, search.sort, search.view],
  );

  const data = useMapData({
    snapshot: snapshotQuery.data,
    alerts: alertsQuery.data,
    selectedId: search.v ?? null,
    hoveredKey,
  });
  const rowsRef = useRef(data.rows);
  useEffect(() => {
    rowsRef.current = data.rows;
  }, [data.rows]);

  const rows = useMemo(
    () => sortRows(filterRows(data.rows, filters, bounds), filters.sort),
    [data.rows, filters, bounds],
  );

  const depots = useMemo(
    () =>
      [...new Set(data.rows.map((row) => row.depot).filter((depot) => depot !== ""))].sort((a, b) =>
        a.localeCompare(b, "en"),
      ),
    [data.rows],
  );

  const selectedId = search.v ?? null;
  const selectedRow = data.rows.find((row) => row.id === selectedId) ?? null;
  const selectedKey = selectedRow?.key ?? null;
  const hoveredRow = data.rows.find((row) => row.key === hoveredKey) ?? null;

  const offline = network === "offline";
  // Offline is a state, not an error: keep the cached map and rows and let the
  // banner and stale treatment explain why nothing is refreshing.
  const snapshotError = !offline && snapshotQuery.error ? normalize(snapshotQuery.error) : null;
  const geofenceError = useMemo(
    () => (!offline && geofencesFailed && geofencesCause ? normalize(geofencesCause) : null),
    [offline, geofencesFailed, geofencesCause],
  );
  const alertsError = !offline && alertsQuery.error ? normalize(alertsQuery.error) : null;
  const hasData = data.total > 0;
  const loadingCancelledActive =
    loadingCancelled && !snapshotQuery.isFetching && !hasData;
  const snapshotPending = snapshotQuery.isPending && !loadingCancelledActive;
  const snapshotUnavailable = snapshotError !== null && !hasData;

  const retrySnapshot = useCallback(() => {
    setLoadingCancelled(false);
    void snapshotQuery.refetch();
  }, [snapshotQuery]);

  const cancelSnapshot = useCallback(() => {
    setLoadingCancelled(true);
    void queryClient.cancelQueries({ queryKey: queryKeys.liveSnapshot });
  }, [queryClient]);

  const freshness = mapFreshness({
    offline,
    socket,
    socketDownAt,
    lastDataAt,
    now: data.now,
    staleAfterMs: STALE_AFTER_MS,
    socketGraceMs: SOCKET_STALE_GRACE_MS,
  });
  const stale = freshness.stale;
  const staleLabel = formatClockTime(lastDataAt ?? data.lastDataAtMs);
  const openAlertCount = alertsQuery.data?.length;

  const mapVehicles = useMemo(() => {
    const visible = new Set(rows.map((row) => row.key));
    return data.mapVehicles.filter(
      (vehicle) => visible.has(vehicle.key) || vehicle.key === selectedKey,
    );
  }, [data.mapVehicles, rows, selectedKey]);

  const mapGeofences = useMemo(
    () => (preferences.geofencesVisible ? toMapGeofences(geofences ?? []) : []),
    [geofences, preferences.geofencesVisible],
  );

  const handleHover = useCallback(
    (hover: { key: string; point: { x: number; y: number } } | null) => {
      setHoveredKey(hover?.key ?? null);
      setHoverPoint(hover?.point ?? null);
    },
    [],
  );

  useDocumentTitle("Map", openAlertCount);

  useEffect(() => {
    setMapDebug({ stale });
  }, [stale]);

  const padding = fitPadding({ isDesktop, panelOpen: preferences.panelOpen, sheetSnap });
  const rowHeight = isDesktop ? MAP_ROW_HEIGHT : MAP_ROW_HEIGHT_TOUCH;

  const updateSearch = useCallback(
    (patch: Record<string, string | number | undefined>, replace = true) => {
      void navigate({
        to: "/map",
        search: (previous) => ({ ...previous, ...patch }),
        replace,
      });
    },
    [navigate],
  );

  const changeFilters = useCallback(
    (patch: Partial<MapFilterValues>) => {
      const next: Record<string, string | number | undefined> = {};
      if ("q" in patch) next.q = patch.q?.trim() || undefined;
      if ("statuses" in patch) next.status = serializeStatuses(patch.statuses ?? []);
      if ("depot" in patch) next.depot = patch.depot ?? undefined;
      if ("sort" in patch) next.sort = patch.sort === "plate" ? undefined : patch.sort;
      if ("onlyInView" in patch) next.view = patch.onlyInView ? 1 : undefined;
      updateSearch(next);
    },
    [updateSearch],
  );

  const resetFilters = useCallback(() => {
    updateSearch({ q: undefined, status: undefined, depot: undefined, view: undefined });
  }, [updateSearch]);

  const selectKey = useCallback(
    (key: string) => {
      const row = rowsRef.current.find((item) => item.key === key);
      if (row) updateSearch({ v: row.id }, false);
    },
    [updateSearch],
  );

  const fitFleet = useCallback(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const positioned = data.rows.filter((row) => row.lat !== null && row.lon !== null);
    const lats = positioned.map((row) => row.lat).filter((value): value is number => value !== null);
    const lons = positioned.map((row) => row.lon).filter((value): value is number => value !== null);
    if (lats.length === 0 || lons.length === 0) return;
    const fleetBounds = {
      south: Math.min(...lats),
      north: Math.max(...lats),
      west: Math.min(...lons),
      east: Math.max(...lons),
    };
    setMapDebug({ fitBounds: fleetBounds, fitCount: (readMapDebug().fitCount ?? 0) + 1 });
    adapter.fitBounds(fleetBounds, { padding, animate: true });
    const afterFit = adapter.getViewport();
    setMapDebug({
      viewport: { center: afterFit.center, zoom: afterFit.zoom, bearing: afterFit.bearing },
      bearing: afterFit.bearing,
    });
  }, [data.rows, padding]);

  const handleAdapterReady = useCallback((adapter: MapAdapter | null) => {
    adapterRef.current = adapter;
  }, []);

  const closePanel = useCallback(() => {
    preferences.setPanelOpen(false);
    setTimeout(() => panelToggleRef.current?.focus(), 0);
  }, [preferences]);

  useEffect(() => {
    if (fittedOnce.current || !adapterRef.current || data.positioned === 0) return;
    fittedOnce.current = true;
    fitFleet();
  }, [data.positioned, fitFleet]);

  useEffect(() => {
    if (!geofenceError) return;
    const copy = errorCopy(geofenceError);
    toast({
      tone: "error",
      title: copy.title,
      description: copy.detail,
      key: "geofences-error",
      action: { label: "Retry", onClick: () => void refetchGeofences() },
    });
  }, [geofenceError, refetchGeofences, toast]);

  useMapShortcuts({
    rows,
    selectedKey,
    onSelect: selectKey,
    onTogglePanel: () => preferences.setPanelOpen(!preferences.panelOpen),
  });

  const kpiCells: KpiCell[] = [
    {
      label: "Online",
      value: snapshotUnavailable
        ? "—"
        : `${formatNumber(data.online)} of ${formatNumber(data.total)}`,
      ...(snapshotUnavailable ? {} : { hint: "vehicles reporting" }),
      onClick: () => changeFilters({ statuses: ["moving", "idle", "alert"] }),
      ...(snapshotUnavailable
        ? { error: true, retrying: snapshotQuery.isFetching, onRetry: retrySnapshot }
        : {}),
    },
    {
      label: "Active trips",
      value: snapshotUnavailable ? "—" : formatNumber(data.activeTrips),
      onClick: () => void navigate({ to: "/trips", search: { status: "active" } }),
    },
    {
      label: "Open alerts",
      value: alertsError ? "—" : openAlertCountLabel(openAlertCount, OPEN_ALERT_LIMIT),
      onClick: () => void navigate({ to: "/alerts", search: { status: "open" } }),
      ...(alertsError
        ? {
            error: true,
            retrying: alertsQuery.isFetching,
            onRetry: () => void alertsQuery.refetch(),
          }
        : {}),
    },
    {
      label: "Last data",
      value:
        snapshotUnavailable || freshness.ageSeconds === null
          ? "—"
          : formatAgeSeconds(freshness.ageSeconds),
      ...(lastDataAt && !snapshotUnavailable ? { hint: formatClockTime(lastDataAt) } : {}),
      onClick: retrySnapshot,
    },
  ];

  const panelProps: VehiclePanelProps = {
    rows,
    total: data.total,
    positioned: data.positioned,
    filters,
    depots,
    loading: snapshotPending,
    fetching: snapshotQuery.isFetching,
    cancelled: loadingCancelledActive,
    error: snapshotError,
    stale,
    staleLabel,
    selectedKey,
    rowHeight,
    signature: filterSignature(filters),
    onSelect: selectKey,
    onHover: (key) => {
      setHoveredKey(key);
      setHoverPoint(null);
    },
    onFilterChange: changeFilters,
    onReset: resetFilters,
    onRetry: retrySnapshot,
    onCancelLoading: cancelSnapshot,
  };

  return (
    <div className="relative h-full min-h-0">
      <h1 className="sr-only">Map</h1>

      <ErrorBoundary level="panel" resetKeys={[selectedKey]}>
        <MapView
          vehicles={mapVehicles}
          geofences={mapGeofences}
          selectedKey={selectedKey}
          hoveredKey={hoveredKey}
          hoveredRow={hoveredRow}
          hoverPoint={hoverPoint}
          dimmed={offline}
          loading={snapshotPending}
          error={snapshotPending ? null : snapshotError}
          hasData={hasData}
          showErrorOverlay
          onRetry={retrySnapshot}
          onSelect={selectKey}
          onHover={handleHover}
          onViewport={setBounds}
          onAdapterReady={handleAdapterReady}
        />
      </ErrorBoundary>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center pl-3 pr-14 lg:right-3 lg:px-3",
          preferences.panelOpen ? "lg:left-93" : "lg:left-3",
        )}
      >
        <div className="pointer-events-auto w-full max-w-md">
          <ErrorBoundary level="panel">
            <KpiStrip cells={kpiCells} compact={!isDesktop} loading={snapshotPending} />
          </ErrorBoundary>
        </div>
      </div>

      {isDesktop && preferences.panelOpen ? (
        <aside className="absolute bottom-3 left-3 top-3 z-20 w-panel">
          <ErrorBoundary level="panel">
            <VehiclePanel
              {...panelProps}
              className="h-full rounded-lg border border-border shadow-float"
              showHeader
              onClose={closePanel}
            />
          </ErrorBoundary>
        </aside>
      ) : null}

      {!isDesktop ? (
        <MobileVehicleSheet
          snap={sheetSnap}
          onSnap={setSheetSnap}
          shown={rows.length}
          total={data.total}
          geofencesVisible={preferences.geofencesVisible}
          fitDisabled={data.positioned === 0}
          onFit={fitFleet}
          onToggleGeofences={preferences.toggleGeofences}
        >
          <ErrorBoundary level="panel">
            <VehiclePanel {...panelProps} showHeader={false} />
          </ErrorBoundary>
        </MobileVehicleSheet>
      ) : null}

      {!isDesktop ? (
        <a
          href={mapConfig.attribution.href}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-28 left-3 z-10 flex h-touch items-center rounded-md bg-surface px-2 text-xs text-muted shadow-menu focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
        >
          {mapConfig.attribution.label}
        </a>
      ) : null}

      {isDesktop ? (
        <ErrorBoundary level="panel" resetKeys={[preferences.panelOpen, preferences.geofencesVisible]}>
          <MapControls
            className="absolute bottom-3 right-3 z-10"
            panelToggleRef={panelToggleRef}
            panelOpen={preferences.panelOpen}
            geofencesVisible={preferences.geofencesVisible}
            fitDisabled={data.positioned === 0}
            onFit={fitFleet}
            onTogglePanel={() => preferences.setPanelOpen(!preferences.panelOpen)}
            onToggleGeofences={preferences.toggleGeofences}
          />
        </ErrorBoundary>
      ) : null}
    </div>
  );
}
