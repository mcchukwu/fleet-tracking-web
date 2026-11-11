import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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
import { GeofenceDeleteDialog } from "./GeofenceDeleteDialog";
import { GeofenceEditor } from "./GeofenceEditor";
import { GeofenceList } from "./GeofenceList";
import { GeofenceMap } from "./GeofenceMap";
import { useGeofenceDelete } from "../hooks/useGeofenceDelete";
import { useGeofenceDrawing } from "../hooks/useGeofenceDrawing";
import { useGeofenceFeed } from "../hooks/useGeofenceFeed";
import { useGeofenceWrite } from "../hooks/useGeofenceWrite";
import { boundsOfGeofences, exteriorRing } from "../lib/geometry";
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
  const write = useGeofenceWrite();
  const deletion = useGeofenceDelete();
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

  const editingGeofence = editor.kind === "edit" ? editor.geofence : null;
  const editingRing = editingGeofence ? exteriorRing(editingGeofence.geometry) : null;
  const editingRings = editingGeofence?.geometry.coordinates.length ?? 0;
  const drawingUnavailable = adapter !== null && !adapter.capabilities.drawing;
  const geometryEditable = editingGeofence
    ? editingRings === 1 && editingRing !== null && !drawingUnavailable
    : !drawingUnavailable;
  const geometryNote = editingGeofence
    ? editingRings > 1
      ? "This geofence has more than one ring. Its shape can't be edited here."
      : editingRing === null
        ? "This geofence's shape isn't valid. Its name and kind can still be edited."
        : drawingUnavailable
          ? "Drawing isn't available on this map. Name and kind can still be edited."
          : undefined
    : undefined;
  const editorOpen = editor.kind === "create" || editor.kind === "edit";
  const drawing = useGeofenceDrawing({
    adapter,
    active: editorOpen && geometryEditable,
    kind: editingGeofence?.kind ?? "depot",
    initialRing: geometryEditable ? editingRing : null,
  });

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
      : drawingUnavailable
        ? "Drawing isn't available on this map."
        : undefined;
  const editReason = !canMutate
    ? "Your role can't change geofences."
    : offline
      ? "You're offline."
      : undefined;

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
  const editingMapId = editingGeofence && drawing.status === "ready" ? editingGeofence.id : null;

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
      if (editorOpen) return;
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
      geofenceCount: mapGeofences.filter((row) => row.id !== editingMapId).length,
      selectedKey: selectedId,
      baseStyle: adapter?.getStyleState().style ?? null,
      styleState: adapter?.getStyleState().status ?? null,
      activeStyle: adapter?.getStyleState().style ?? null,
      viewport: adapter?.getViewport() ?? null,
      bounds: adapter?.getViewport().bounds ?? null,
    });
    if (import.meta.env.DEV) window.__FLEET_TEST_MAP__ = adapter;
  }, [adapter, editingMapId, mapGeofences, selectedId]);

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

  function focusRow(id: string | null): void {
    setTimeout(() => {
      if (id) {
        const target = document.querySelector<HTMLElement>(
          `[data-geofence-id="${CSS.escape(id)}"]`,
        );
        if (target) {
          target.focus();
          return;
        }
      }
      createRef.current?.focus();
    }, 0);
  }

  function closeEditor(): void {
    drawing.cancel();
    setEditor({ kind: "closed" });
    setTimeout(() => {
      const editButton = document.querySelector<HTMLElement>("[data-edit-geofence]");
      if (editButton) {
        editButton.focus();
        return;
      }
      createRef.current?.focus();
    }, 0);
  }

  function afterSaved(id: string | null): void {
    drawing.stop();
    setEditor({ kind: "closed" });
    lastFitId.current = null;
    updateSearch({ q: undefined, selected: id ?? undefined });
    focusRow(id);
  }

  async function refreshEditTarget(): Promise<void> {
    const rows = await feed.refetch();
    if (editor.kind === "edit" && !rows?.some((row) => row.id === editor.geofence.id)) {
      closeEditor();
    }
  }

  async function refreshDeleteTarget(): Promise<void> {
    const rows = await feed.refetch();
    if (editor.kind === "delete" && !rows?.some((row) => row.id === editor.geofence.id)) {
      setEditor({ kind: "closed" });
      updateSearch({ selected: undefined });
    }
  }

  function afterDelete(): void {
    const deletedId = editor.kind === "delete" ? editor.geofence.id : null;
    const next = visible.find((row) => row.id !== deletedId)?.id ?? null;
    setEditor({ kind: "closed" });
    lastFitId.current = null;
    if (selectedId === deletedId) updateSearch({ selected: undefined });
    focusRow(next);
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
            {q.trim() !== "" ? (
              <>
                Showing <span className="tabular-nums">{formatCount(visible.length)}</span>
                {" of "}
                <span className="tabular-nums">{formatCount(feed.geofences.length)}</span>
              </>
            ) : (
              <>
                <span className="tabular-nums">{formatCount(visible.length)}</span> geofences
              </>
            )}
          </p>
        </div>
        <Button
          ref={createRef}
          variant="primary"
          className="min-w-touch md:min-w-0"
          aria-label="Create geofence"
          leadingIcon={<Plus aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          data-create-geofence
          {...(createReason ? { disabledReason: createReason } : {})}
          onClick={() => setEditor({ kind: "create" })}
        >
          <span className="hidden md:inline">Create geofence</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="border-border order-2 flex min-h-0 basis-2/5 flex-col border-t lg:order-1 lg:w-panel lg:shrink-0 lg:basis-auto lg:border-t-0 lg:border-r">
          {editorOpen ? (
            <GeofenceEditor
              mode={editor.kind === "edit" ? "edit" : "create"}
              geofence={editingGeofence}
              drawing={drawing}
              write={write}
              knownIds={new Set(feed.geofences.map((row) => row.id))}
              geometryEditable={geometryEditable}
              {...(geometryNote ? { geometryNote } : {})}
              {...(editReason ? { disabledReason: editReason } : {})}
              onClose={closeEditor}
              onSaved={afterSaved}
              onRefresh={() => void refreshEditTarget()}
            />
          ) : (
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
          )}
        </div>

        <div className="order-1 flex min-h-48 flex-1 flex-col lg:order-2">
          <GeofenceMap
            geofences={mapGeofences}
            editingId={editingMapId}
            adapter={adapter}
            offline={offline}
            {...(hint ? { hint } : {})}
            fitDisabled={feed.geofences.length === 0}
            onAdapter={setAdapter}
            onFitAll={fitAll}
          />
        </div>
      </div>

      <GeofenceDeleteDialog
        geofence={editor.kind === "delete" ? editor.geofence : null}
        open={editor.kind === "delete"}
        write={deletion}
        {...(editReason ? { disabledReason: editReason } : {})}
        onClose={() => setEditor({ kind: "closed" })}
        onDeleted={afterDelete}
        onRefresh={refreshDeleteTarget}
      />
    </div>
  );
}
