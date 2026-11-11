import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { Geofence } from "../../../api/types";
import type { GeofencesSearch } from "../../../app/search";
import { useCan } from "../../../auth/useCan";
import { setMapDebug } from "../../../dev/debug";
import { normalize } from "../../../errors/normalize";
import { formatClockTime, formatCount } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useMediaQuery } from "../../../lib/useMediaQuery";
import { toMapGeofences } from "../../../map/geofences";
import type { MapAdapter } from "../../../map/types";
import { useConnection } from "../../../stores/connection";
import { Button } from "../../../ui/Button";
import type { StateBoundaryState } from "../../../ui/StateBoundary";
import { GeofenceList } from "./GeofenceList";
import { GeofenceMap } from "./GeofenceMap";
import { useGeofenceFeed } from "../hooks/useGeofenceFeed";
import { boundsOfGeofences } from "../lib/geometry";
import { filterGeofences, sortGeofences } from "../lib/filter";
import { FIT_PADDING_DESKTOP, FIT_PADDING_MOBILE } from "../lib/constants";

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; geofence: Geofence }
  | { kind: "delete"; geofence: Geofence };

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "geofences";

export function GeofencesPage() {
  if (INJECT_CRASH) throw new Error("Injected geofences crash");
  return <GeofencesPageContent />;
}

function GeofencesPageContent() {
  const search = useSearch({ from: "/_app/geofences" });
  const navigate = useNavigate();
  const canMutate = useCan("mutate");
  const { network } = useConnection();
  const offline = network === "offline";
  const wide = useMediaQuery("(min-width: 1024px)");
  const createRef = useRef<HTMLButtonElement>(null);

  const feed = useGeofenceFeed();
  const [adapter, setAdapter] = useState<MapAdapter | null>(null);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const [selectionReset, setSelectionReset] = useState(0);
  const initialFitDone = useRef(false);
  const lastFitId = useRef<string | null>(null);

  const q = search.q ?? "";
  const selectedId = search.selected ?? null;

  const visible = useMemo(
    () => sortGeofences(filterGeofences(feed.geofences, q)),
    [feed.geofences, q],
  );
  const selected = useMemo(
    () => (selectedId ? (feed.geofences.find((row) => row.id === selectedId) ?? null) : null),
    [feed.geofences, selectedId],
  );

  useDocumentTitle("Geofences");

  const closedError = !offline && feed.error ? normalize(feed.error) : null;
  const state: StateBoundaryState =
    closedError?.kind === "forbidden"
      ? "forbidden"
      : feed.isLoading && feed.geofences.length === 0
        ? "loading"
        : closedError
          ? "error"
          : offline && visible.length > 0
            ? "stale"
            : visible.length === 0
              ? "empty"
              : "ready";

  const notFound =
    selectedId !== null &&
    !feed.isLoading &&
    !closedError &&
    feed.dataUpdatedAt > 0 &&
    selected === null;
  const staleLabel =
    feed.geofences.length > 0 && (offline || state === "error") && feed.dataUpdatedAt
      ? formatClockTime(feed.dataUpdatedAt)
      : undefined;

  const createReason = !canMutate
    ? "Your role can't create geofences."
    : offline
      ? "You're offline."
      : undefined;
  const editorOpen = editor.kind === "create" || editor.kind === "edit";

  const updateSearch = useCallback(
    (patch: Partial<GeofencesSearch>, replace = true): void => {
      void navigate({ to: "/geofences", search: { ...search, ...patch }, replace });
    },
    [navigate, search],
  );

  const mapGeofences = useMemo(
    () => toMapGeofences(feed.geofences, selectedId),
    [feed.geofences, selectedId],
  );

  const fitPadding = wide ? FIT_PADDING_DESKTOP : FIT_PADDING_MOBILE;

  const fitAll = useCallback(() => {
    if (!adapter) return;
    const bounds = boundsOfGeofences(feed.geofences);
    if (bounds) adapter.fitBounds(bounds, { padding: fitPadding });
  }, [adapter, feed.geofences, fitPadding]);

  const fitOne = useCallback(
    (id: string) => {
      if (!adapter) return;
      const geofence = feed.geofences.find((row) => row.id === id);
      if (!geofence) return;
      const bounds = boundsOfGeofences([geofence]);
      if (bounds) adapter.fitBounds(bounds, { padding: fitPadding });
    },
    [adapter, feed.geofences, fitPadding],
  );

  useEffect(() => {
    if (!adapter) return;
    const offFence = adapter.on("geofenceClick", ({ id }) => {
      const hiddenBySearch = filterGeofences(feed.geofences, q).every((row) => row.id !== id);
      updateSearch(hiddenBySearch ? { q: undefined, selected: id } : { selected: id }, false);
    });
    const offMap = adapter.on("mapClick", () => {
      if (!editorOpen) updateSearch({ selected: undefined });
    });
    return () => {
      offFence();
      offMap();
    };
  }, [adapter, editorOpen, feed.geofences, q, updateSearch]);

  useEffect(() => {
    if (!adapter) return;
    if (selectedId && selected) {
      if (lastFitId.current === selectedId) return;
      lastFitId.current = selectedId;
      fitOne(selectedId);
      return;
    }
    if (!initialFitDone.current && feed.geofences.length > 0) {
      initialFitDone.current = true;
      fitAll();
    }
  }, [adapter, feed.geofences.length, fitAll, fitOne, selected, selectedId]);

  useEffect(() => {
    setMapDebug({
      mapLoaded: adapter !== null,
      provider: adapter?.id ?? null,
      geofenceCount: mapGeofences.length,
      selectedKey: selectedId,
      baseStyle: adapter?.getStyleState().style ?? null,
      styleState: adapter?.getStyleState().status ?? null,
      activeStyle: adapter?.getStyleState().style ?? null,
      viewport: adapter?.getViewport() ?? null,
      bounds: adapter?.getViewport().bounds ?? null,
    });
    if (import.meta.env.DEV) window.__FLEET_TEST_MAP__ = adapter;
  }, [adapter, mapGeofences.length, selectedId]);

  useEffect(
    () => () => {
      if (import.meta.env.DEV) window.__FLEET_TEST_MAP__ = null;
      setMapDebug({ mapLoaded: false, provider: null, geofenceCount: 0 });
    },
    [],
  );

  function selectRow(id: string): void {
    updateSearch({ selected: id }, false);
  }

  function clearSelection(): void {
    lastFitId.current = null;
    updateSearch({ selected: undefined });
    setSelectionReset((value) => value + 1);
  }

  function changeSearch(value: string): void {
    updateSearch({ q: value === "" ? undefined : value });
    setSelectionReset((value) => value + 1);
  }

  const hint =
    editor.kind === "create"
      ? "Click to add points. Click the first point or press Enter to close."
      : editor.kind === "edit"
        ? "Drag a vertex or midpoint to adjust the shape."
        : undefined;

  return (
    <div
      data-testid="geofences-page"
      className="text-text flex h-full min-h-0 w-full flex-col"
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-2 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-text text-lg font-semibold">Geofences</h1>
          <p className="text-muted text-sm">
            <span className="tabular-nums">{formatCount(visible.length)}</span>
            {q.trim() !== "" ? (
              <>
                {" of "}
                <span className="tabular-nums">{formatCount(feed.geofences.length)}</span> geofences
              </>
            ) : (
              " geofences"
            )}
          </p>
        </div>
        <Button
          ref={createRef}
          variant="primary"
          data-create-geofence
          {...(createReason ? { disabledReason: createReason } : {})}
          onClick={() => setEditor({ kind: "create" })}
        >
          Create geofence
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="border-border order-2 flex min-h-0 basis-2/5 flex-col border-t lg:order-1 lg:w-panel lg:shrink-0 lg:basis-auto lg:border-t-0 lg:border-r">
          <GeofenceList
            geofences={visible}
            total={feed.geofences.length}
            q={q}
            selected={selected}
            state={state}
            error={closedError}
            {...(staleLabel ? { staleLabel } : {})}
            cancelled={feed.cancelled}
            offline={offline}
            canMutate={canMutate}
            notFound={notFound}
            forbiddenAction={
              <Link
                to="/map"
                className="h-touch text-accent-fg md:h-control-md inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
              >
                Go back
              </Link>
            }
            onSearch={changeSearch}
            onSelect={selectRow}
            onEdit={() => {
              if (selected) setEditor({ kind: "edit", geofence: selected });
            }}
            onDelete={() => {
              if (selected) setEditor({ kind: "delete", geofence: selected });
            }}
            onCreate={() => setEditor({ kind: "create" })}
            onClearSelection={clearSelection}
            onRetry={() => void feed.retry()}
            onCancelLoading={feed.cancel}
            resetKey={`${q}:${selectionReset}`}
          />
        </div>

        <div className="order-1 flex min-h-48 flex-1 flex-col lg:order-2">
          <GeofenceMap
            geofences={mapGeofences}
            adapter={adapter}
            offline={offline}
            {...(hint ? { hint } : {})}
            fitDisabled={feed.geofences.length === 0}
            onAdapter={setAdapter}
            onFitAll={fitAll}
          />
        </div>
      </div>
    </div>
  );
}
