import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useOpenAlerts, OPEN_ALERT_LIMIT } from "../../../api/hooks/alerts";
import { useGeofences } from "../../../api/hooks/geofences";
import { useLiveSnapshot } from "../../../api/hooks/vehicles";
import { queryKeys } from "../../../api/keys";
import { MapAttribution } from "../../../map/MapAttribution";
import { toMapGeofences } from "../../../map/geofences";
import { useAuthStore } from "../../../auth/store";
import { errorCopy } from "../../../errors/catalog";
import { ErrorBoundary } from "../../../errors/ErrorBoundary";
import { normalize } from "../../../errors/normalize";
import { formatAgeSeconds, formatClockTime, formatNumber } from "../../../lib/format";
import { STALE_AFTER_MS } from "../../../lib/status";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useMediaQuery } from "../../../lib/useMediaQuery";
import { readMapDebug, setMapDebug } from "../../../dev/debug";
import type { MapAdapter, MapStyleState, Viewport } from "../../../map/types";
import type { Vehicle } from "../../../api/types";
import { useConnection } from "../../../stores/connection";
import { useToast } from "../../../ui/Toast";
import { cn } from "../../../ui/cn";
import { useMapData } from "../hooks/useMapData";
import { useMapPreferences } from "../hooks/useMapPreferences";
import { useMapShortcuts } from "../hooks/useMapShortcuts";
import { useMapStyle } from "../hooks/useMapStyle";
import { useCan } from "../../../auth/useCan";
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
import { fitPadding, type SheetSnap } from "../lib/padding";
import { isHostedMapStyle, MAP_STYLE_LABELS } from "../lib/styles";
import { KpiStrip, type KpiCell } from "./KpiStrip";
import { MapControls } from "./MapControls";
import { MapTilerLogo } from "./MapTilerLogo";
import { MapView } from "./MapView";
import { MobileVehicleSheet } from "./MobileVehicleSheet";
import { AssignDriverDialog } from "./AssignDriverDialog";
import { VehicleDrawer } from "./VehicleDrawer";
import { VehicleDetailSheet } from "./VehicleDetailSheet";
import { VehicleEditDialog } from "./VehicleEditDialog";
import { VehiclePanel, type VehiclePanelProps } from "./VehiclePanel";

export function MapPage() {
  const search = useSearch({ from: "/_app/map" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");
  const authenticated = useAuthStore((state) => state.status === "authenticated");
  const canMutate = useCan("mutate");
  const snapshotQuery = useLiveSnapshot(authenticated);
  const {
    data: geofences,
    isError: geofencesFailed,
    error: geofencesCause,
    refetch: refetchGeofences,
  } = useGeofences(authenticated);
  const alertsQuery = useOpenAlerts(authenticated);
  const preferences = useMapPreferences();
  const mapStyle = useMapStyle();
  const {
    fallback: mapStyleFallback,
    chooseStyle: chooseMapStyle,
    dismissFallback: dismissMapStyleFallback,
  } = mapStyle;
  const { network, socket, socketDownAt, lastDataAt } = useConnection();
  const { toast } = useToast();

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [loadingCancelled, setLoadingCancelled] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const bounds = viewport?.bounds ?? null;
  const [listSnap, setListSnap] = useState<SheetSnap>("peek");
  const [detailSnap, setDetailSnap] = useState<SheetSnap>("half");
  const [sheetObscured, setSheetObscured] = useState(false);
  const [mapStyleState, setMapStyleState] = useState<MapStyleState | null>(null);
  const [styleAttribution, setStyleAttribution] = useState<readonly string[] | null>(null);
  const [writeVehicle, setWriteVehicle] = useState<Vehicle | null>(null);
  const [writeMode, setWriteMode] = useState<"edit" | "assign" | null>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const sheetHandleRef = useRef<HTMLButtonElement>(null);
  const mapRootRef = useRef<HTMLDivElement>(null);
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
  const snapshotVehicle =
    snapshotQuery.data?.find((vehicle) => vehicle.id === selectedId) ?? null;
  const hoveredRow = data.rows.find((row) => row.key === hoveredKey) ?? null;
  const drawerOpen = selectedId !== null;
  const panelVisible = preferences.panelOpen && (!drawerOpen || isXl);
  const sheetSnap = drawerOpen && !isDesktop ? detailSnap : listSnap;

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

  const padding = fitPadding({
    isDesktop,
    panelOpen: panelVisible,
    sheetSnap,
    drawerOpen,
  });
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
    updateSearch({
      q: undefined,
      status: undefined,
      depot: undefined,
      sort: undefined,
      view: undefined,
    });
  }, [updateSearch]);

  const focusOrigin = useCallback(
    (key: string | null) => {
      requestAnimationFrame(() => {
        const rowButton =
          key === null
            ? null
            : document.querySelector<HTMLElement>(
                `[data-vehicle-key="${CSS.escape(key)}"] button`,
              );
        if (rowButton) {
          rowButton.focus();
          return;
        }
        if (!isDesktop) {
          // A row outside the rendered list window falls back to the sheet handle.
          sheetHandleRef.current?.focus();
          return;
        }
        const search = document.querySelector<HTMLElement>('input[name="vehicle-search"]');
        (search ?? mapRootRef.current)?.focus();
      });
    },
    [isDesktop],
  );

  const closeDrawer = useCallback(() => {
    updateSearch({ v: undefined });
  }, [updateSearch]);

  const closeDetailSheet = useCallback(() => {
    closeDrawer();
    focusOrigin(selectedKey);
  }, [closeDrawer, focusOrigin, selectedKey]);

  const centreSelected = useCallback(
    (position?: { lat: number; lon: number }) => {
      const adapter = adapterRef.current;
      const target =
        position ??
        (selectedRow && selectedRow.lat !== null && selectedRow.lon !== null
          ? { lat: selectedRow.lat, lon: selectedRow.lon }
          : null);
      if (!adapter || !target) return;
      adapter.flyTo([target.lon, target.lat], Math.max(adapter.getViewport().zoom, 13), {
        padding,
      });
      if (!isDesktop) setDetailSnap("peek");
    },
    [isDesktop, padding, selectedRow],
  );

  const openPlayback = useCallback(() => {
    if (!selectedId) return;
    const to = new Date();
    const from = new Date(to.getTime() - 2 * 60 * 60_000);
    void navigate({
      to: "/playback",
      search: {
        vehicle: selectedId,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  }, [navigate, selectedId]);

  const openEdit = useCallback((vehicle: Vehicle) => {
    setWriteVehicle(vehicle);
    setWriteMode("edit");
  }, []);

  const openAssign = useCallback((vehicle: Vehicle) => {
    setWriteVehicle(vehicle);
    setWriteMode("assign");
  }, []);

  const closeWrite = useCallback(() => {
    const mode = writeMode;
    setWriteMode(null);
    setWriteVehicle(null);
    requestAnimationFrame(() => {
      const label = mode === "edit" ? "Edit" : "Assign driver";
      const root = mapRootRef.current;
      if (!root) return;
      const target = [...root.querySelectorAll<HTMLElement>("button")].find(
        (button) =>
          button.textContent?.trim() === label || button.getAttribute("aria-label") === label,
      );
      target?.focus();
    });
  }, [writeMode]);

  const refreshWriteVehicle = useCallback(() => {
    if (!writeVehicle) return;
    const id = writeVehicle.id;
    void (async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.drivers }),
      ]);
      const fresh = queryClient.getQueryData<Vehicle>(queryKeys.vehicle(id));
      if (fresh) setWriteVehicle(fresh);
    })();
  }, [queryClient, writeVehicle]);

  const selectKey = useCallback(
    (key: string) => {
      const row = rowsRef.current.find((item) => item.key === key);
      if (row) {
        if (!isDesktop) setDetailSnap("half");
        updateSearch({ v: row.id }, false);
      }
    },
    [isDesktop, updateSearch],
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
    if (import.meta.env.DEV && import.meta.env.VITE_MOCK === "1") {
      window.__FLEET_TEST_MAP__ = adapter;
    }
  }, []);

  const failMapStyle = mapStyle.failStyle;

  const handleMapStyleChange = useCallback(
    (state: MapStyleState) => {
      setMapStyleState(state);
      if (state.status === "ready") setStyleAttribution(state.attribution);
      setMapDebug({ styleState: state.status, activeStyle: state.style });
      if (state.failedStyle) {
        failMapStyle(state.failedStyle, state.reason ?? "failed");
      }
    },
    [failMapStyle],
  );

  const zoomIn = useCallback(() => adapterRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => adapterRef.current?.zoomOut(), []);
  const resetBearing = useCallback(() => adapterRef.current?.resetBearing(), []);

  const closePanel = useCallback(() => {
    preferences.setPanelOpen(false);
    setTimeout(() => panelToggleRef.current?.focus(), 0);
  }, [preferences]);

  const togglePanel = useCallback(() => {
    if (drawerOpen && !isXl) {
      toast({
        tone: "info",
        title: "Close the vehicle drawer to show the list.",
        key: "panel-blocked-by-drawer",
      });
      return;
    }
    preferences.setPanelOpen(!preferences.panelOpen);
  }, [drawerOpen, isXl, preferences, toast]);

  const focusSheetHandle = useCallback(() => {
    sheetHandleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (fittedOnce.current || !adapterRef.current || data.positioned === 0) return;
    fittedOnce.current = true;
    fitFleet();
  }, [data.positioned, fitFleet]);

  useEffect(() => {
    if (!mapStyleFallback) return;
    const { style, reason } = mapStyleFallback;
    const label = MAP_STYLE_LABELS[style];
    if (reason === "offline") {
      toast({
        tone: "info",
        title: "Showing the standard map.",
        description: `${label} needs a connection.`,
        key: "map-style-offline",
      });
    } else {
      toast({
        tone: "error",
        title: `${label} couldn't load. Showing the standard map.`,
        key: "map-style-failed",
        action: { label: "Retry", onClick: () => chooseMapStyle(style) },
      });
    }
    dismissMapStyleFallback();
  }, [mapStyleFallback, chooseMapStyle, dismissMapStyleFallback, toast]);

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
    onTogglePanel: togglePanel,
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

  const kpiHidden = !isDesktop && sheetSnap === "full";
  const activeStyle = mapStyleState?.style ?? "standard";
  const loadingStyle =
    mapStyleState?.status === "loading" ? mapStyleState.targetStyle ?? null : null;
  const hostedActive = isHostedMapStyle(activeStyle);
  const controlsProps = {
    bearing: viewport?.bearing ?? 0,
    zoom: viewport?.zoom ?? 7,
    styles: mapStyle.styles,
    baseStyle: mapStyle.effectiveStyle,
    offline: mapStyle.offline,
    styleLoading: loadingStyle,
    panelOpen: panelVisible,
    panelToggleReason:
      drawerOpen && !isXl ? "Close the vehicle drawer to show the list." : undefined,
    geofencesVisible: preferences.geofencesVisible,
    fitDisabled: data.positioned === 0,
    panelToggleRef,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onResetBearing: resetBearing,
    onFit: fitFleet,
    onTogglePanel: togglePanel,
    onToggleGeofences: preferences.toggleGeofences,
    onStyleChange: mapStyle.chooseStyle,
    onObscuredFocusLoss: focusSheetHandle,
  };

  return (
    <div
      ref={mapRootRef}
      data-testid="map-root"
      data-drawer-open={drawerOpen ? "true" : undefined}
      tabIndex={-1}
      className="map-root relative h-full min-h-0 focus:outline-none"
    >
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
          baseStyle={mapStyle.effectiveStyle}
          loading={snapshotPending}
          error={snapshotPending ? null : snapshotError}
          hasData={hasData}
          showErrorOverlay
          onRetry={retrySnapshot}
          onSelect={selectKey}
          onHover={handleHover}
          onViewport={setViewport}
          onStyleChange={handleMapStyleChange}
          onAdapterReady={handleAdapterReady}
          flyPadding={padding}
          drawerOpen={drawerOpen}
        />
      </ErrorBoundary>

      {kpiHidden ? null : (
        <div
          className={cn(
            "map-kpi pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center pl-3 pr-14 lg:right-3 lg:px-3",
            panelVisible ? "lg:left-93" : "lg:left-3",
          )}
        >
          <div className="pointer-events-auto w-full max-w-md">
            <ErrorBoundary level="panel">
              <KpiStrip cells={kpiCells} compact={!isDesktop} loading={snapshotPending} />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {isDesktop && panelVisible ? (
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

      {isDesktop && drawerOpen && selectedId ? (
        <ErrorBoundary level="panel" resetKeys={[selectedId]}>
          <VehicleDrawer
            key={selectedId}
            vehicleId={selectedId}
            row={selectedRow}
            snapshotVehicle={snapshotVehicle}
            mapReady={viewport !== null}
            canMutate={canMutate}
            offline={offline}
            onClose={closeDrawer}
            onCentre={centreSelected}
            onPlayback={openPlayback}
            onEdit={openEdit}
            onAssign={openAssign}
            returnFocus={() => focusOrigin(selectedKey)}
          />
        </ErrorBoundary>
      ) : null}

      {!isDesktop ? (
        drawerOpen && selectedId ? (
          <ErrorBoundary level="panel" resetKeys={[selectedId]}>
            <VehicleDetailSheet
              key={selectedId}
              vehicleId={selectedId}
              row={selectedRow}
              snapshotVehicle={snapshotVehicle}
              snap={detailSnap}
              onSnap={setDetailSnap}
              mapReady={viewport !== null}
              canMutate={canMutate}
              offline={offline}
              onClose={closeDetailSheet}
              onCentre={centreSelected}
              onPlayback={openPlayback}
              onEdit={openEdit}
              onAssign={openAssign}
              insetTarget={mapRootRef}
              handleRef={sheetHandleRef}
              onObscuredChange={setSheetObscured}
            />
          </ErrorBoundary>
        ) : (
          <MobileVehicleSheet
            snap={listSnap}
            onSnap={setListSnap}
            shown={rows.length}
            total={data.total}
            filters={filters}
            depots={depots}
            geofencesVisible={preferences.geofencesVisible}
            fitDisabled={data.positioned === 0}
            insetTarget={mapRootRef}
            handleRef={sheetHandleRef}
            onFit={fitFleet}
            onToggleGeofences={preferences.toggleGeofences}
            onFilterChange={changeFilters}
            onResetFilters={resetFilters}
            onObscuredChange={setSheetObscured}
          >
            <ErrorBoundary level="panel">
              <VehiclePanel
                {...panelProps}
                className="min-h-0 flex-1"
                showHeader={false}
                showFilters={false}
              />
            </ErrorBoundary>
          </MobileVehicleSheet>
        )
      ) : null}

      <div
        data-testid="map-footer"
        className={cn(
          "map-bottom-anchor pointer-events-none absolute left-3 right-3 z-20 flex flex-col items-end gap-2",
          isDesktop
            ? cn("map-inset-right", preferences.panelOpen ? "lg:left-93" : "lg:left-3")
            : "map-inset-bottom",
        )}
      >
        <ErrorBoundary
          level="panel"
          resetKeys={[preferences.panelOpen, preferences.geofencesVisible]}
        >
          <MapControls
            {...controlsProps}
            variant={isDesktop ? "desktop" : "mobile"}
            obscured={!isDesktop && (sheetSnap === "full" || sheetObscured)}
            className="pointer-events-auto shrink-0"
          />
        </ErrorBoundary>

        <div className="pointer-events-none flex min-w-0 justify-end">
          <MapAttribution
            styleId={activeStyle}
            attribution={hostedActive ? styleAttribution : null}
          />
        </div>
      </div>

      {hostedActive ? (
        <div
          data-testid="maptiler-logo-anchor"
          className={cn(
            "map-bottom-anchor pointer-events-none absolute left-3 z-20",
            isDesktop
              ? cn(preferences.panelOpen ? "lg:left-96" : "lg:left-3")
              : "map-inset-bottom",
          )}
        >
          <MapTilerLogo />
        </div>
      ) : null}

      {!isDesktop && sheetSnap === "full" ? (
        <button
          type="button"
          onClick={() => {
            if (drawerOpen) setDetailSnap("half");
            else setListSnap("half");
            focusSheetHandle();
          }}
          className="absolute inset-x-0 top-0 z-10 h-sheet-strip w-full focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
        >
          <span className="sr-only">
            {drawerOpen ? "Collapse the vehicle details" : "Collapse the vehicle list"}
          </span>
        </button>
      ) : null}

      {writeVehicle && writeMode === "edit" && selectedId ? (
        <VehicleEditDialog
          open
          vehicle={writeVehicle}
          onClose={closeWrite}
          onSaved={() =>
            toast({
              tone: "success",
              title: "Vehicle updated.",
              key: `vehicle-updated:${writeVehicle.id}`,
            })
          }
          onRefresh={refreshWriteVehicle}
          readOnly={!canMutate || offline}
        />
      ) : null}

      {writeVehicle && writeMode === "assign" && selectedId ? (
        <AssignDriverDialog
          open
          vehicle={writeVehicle}
          onClose={closeWrite}
          onSaved={() =>
            toast({
              tone: "success",
              title: "Driver assigned.",
              key: `driver-assigned:${writeVehicle.id}`,
            })
          }
          onRefresh={refreshWriteVehicle}
          readOnly={!canMutate || offline}
        />
      ) : null}
    </div>
  );
}
