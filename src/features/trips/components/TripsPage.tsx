import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useTrips } from "../../../api/hooks/trips";
import type { Trip } from "../../../api/types";
import type { TripsSearch } from "../../../app/search";
import { useCanMutate } from "../../../auth/useCanMutate";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";
import { formatClockTime, formatCount } from "../../../lib/format";
import {
  transitionPayload,
  tripEmptyReason,
  tripSortValue,
  type TripAction,
  type TripEmptyReason,
} from "../../../lib/trips";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useConnection } from "../../../stores/connection";
import type { StateBoundaryState } from "../../../ui/StateBoundary";
import { Button } from "../../../ui/Button";
import { PageFrame } from "../../../ui/PageFrame";
import { useTripFeed, visibleTrips } from "../hooks/useTripFeed";
import { tripWriteCopy, useTripWrite } from "../hooks/useTripWrite";
import { TripConfirmDialog } from "./TripConfirmDialog";
import { TripCreateDialog } from "./TripCreateDialog";
import { TripDetailPanel, type TripLookupState } from "./TripDetailPanel";
import { TripFilters, type TripFilterValues } from "./TripFilters";
import { TripAssignDriverDialog } from "./TripAssignDriverDialog";
import { TripTable, type TripActionError } from "./TripTable";

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "trips";

const LOOKUP_LIMIT = 500;
const LOOKUP_REFRESH_MS = 15_000;

export function TripsPage() {
  if (INJECT_CRASH) throw new Error("Injected trips crash");
  return <TripsPageContent />;
}

function TripsPageContent() {
  const search = useSearch({ from: "/_app/trips" });
  const navigate = useNavigate();
  const mutate = useCanMutate("mutate");
  const canMutate = mutate.allowed;
  const { network } = useConnection();
  const offline = network === "offline";
  const createRef = useRef<HTMLButtonElement>(null);

  const filters = useMemo<TripFilterValues>(
    () => ({
      status: search.status ?? null,
      q: search.q ?? "",
      sort: tripSortValue(search.order),
    }),
    [search.status, search.q, search.order],
  );

  const feed = useTripFeed(search.status ? { status: search.status } : {});
  const trips = useMemo(
    () => visibleTrips(feed.trips, filters.q, filters.sort),
    [feed.trips, filters.q, filters.sort],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createScrollReset, setCreateScrollReset] = useState(0);
  const [assignTrip, setAssignTrip] = useState<{
    trip: Trip;
    origin: "row" | "detail";
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    trip: Trip;
    action: Extract<TripAction, "complete" | "cancel">;
    origin: "row" | "detail";
  } | null>(null);
  const [pendingTripId, setPendingTripId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    tripId: string;
    origin: "row" | "detail";
    error: AppError;
    title: string;
    detail: string;
    retry: () => void;
  } | null>(null);
  const write = useTripWrite();

  useDocumentTitle("Trips");

  const selectedId = search.trip ?? null;
  const selectedInFeed = selectedId
    ? (feed.trips.find((trip) => trip.id === selectedId) ?? null)
    : null;
  const lookupEnabled =
    selectedId !== null && selectedInFeed === null && !feed.isLoading;
  const lookup = useTrips(
    { limit: LOOKUP_LIMIT },
    {
      enabled: lookupEnabled,
      refetchInterval: lookupEnabled && !offline ? LOOKUP_REFRESH_MS : false,
    },
  );
  const lookupRows: Trip[] = Array.isArray(lookup.data) ? lookup.data : [];
  const lookupTrip = selectedId
    ? (lookupRows.find((trip) => trip.id === selectedId) ?? null)
    : null;
  const selectedTrip = selectedInFeed ?? lookupTrip;
  const lookupState: TripLookupState =
    selectedId === null
      ? "ready"
      : selectedTrip
        ? "ready"
        : offline
          ? "offline"
          : !lookupEnabled || lookup.isLoading
            ? "loading"
            : lookup.error
              ? "error"
              : "not-found";

  const closedError = !offline && feed.error ? normalize(feed.error) : null;
  const state: StateBoundaryState =
    closedError?.kind === "forbidden"
      ? "forbidden"
      : feed.isLoading && feed.trips.length === 0
        ? "loading"
        : closedError
          ? "error"
          : offline && trips.length > 0
            ? "stale"
            : trips.length === 0
              ? "empty"
              : "ready";

  const emptyReason: TripEmptyReason | null = tripEmptyReason({
    loadedCount: feed.loadedCount,
    visibleCount: trips.length,
    hasMore: feed.hasMore,
    filtered: filters.status !== null || filters.q.trim() !== "",
  });

  const changeReason =
    mutate.blockedBy === "role"
      ? "Your role can't change trips."
      : (mutate.reason ?? undefined);
  const createReason =
    mutate.blockedBy === "role"
      ? "Your role can't create trips."
      : (mutate.reason ?? undefined);

  function updateSearch(patch: Partial<TripsSearch>, replace = true): void {
    void navigate({ to: "/trips", search: { ...search, ...patch }, replace });
  }

  function changeFilters(patch: Partial<TripFilterValues>): void {
    const next: Partial<TripsSearch> = {};
    if ("status" in patch) next.status = patch.status ?? undefined;
    if ("q" in patch) next.q = patch.q ?? undefined;
    if ("sort" in patch)
      next.order = patch.sort === "status" ? undefined : patch.sort;
    updateSearch(next);
  }

  function resetFilters(): void {
    updateSearch({ status: undefined, q: undefined });
  }

  function focusRow(id: string | null): void {
    setTimeout(() => {
      if (id) {
        const target = document.querySelector<HTMLElement>(
          `[data-trip-id="${CSS.escape(id)}"]`,
        );
        if (target) {
          target.focus();
          return;
        }
      }
      document
        .querySelector<HTMLElement>(
          '[data-testid="trips-page"] [data-create-trip]',
        )
        ?.focus();
    }, 0);
  }

  function focusAfterAction(tripId: string, origin: "row" | "detail"): void {
    setTimeout(() => {
      const scope =
        origin === "detail"
          ? document.querySelector<HTMLElement>('[data-testid="drawer"]')
          : document.querySelector<HTMLElement>(
              `[data-trip-row="${CSS.escape(tripId)}"]`,
            );
      if (!scope) {
        document
          .querySelector<HTMLElement>(
            '[data-testid="trips-page"] [data-create-trip]',
          )
          ?.focus();
        return;
      }
      const action = scope.querySelector<HTMLElement>(
        "[data-trip-action],[data-detail-action]",
      );
      const fallback = scope.querySelector<HTMLElement>(
        "[data-trip-id],button",
      );
      (action ?? fallback)?.focus();
    }, 0);
  }

  function openTrip(id: string): void {
    updateSearch({ trip: id }, false);
  }

  function closeTrip(): void {
    updateSearch({ trip: undefined });
  }

  function afterCreate(): void {
    updateSearch({ status: undefined, q: undefined, trip: undefined });
    setCreateScrollReset((value) => value + 1);
    setTimeout(() => createRef.current?.focus(), 0);
  }

  async function runAction(
    trip: Trip,
    action: TripAction,
    origin: "row" | "detail",
  ): Promise<void> {
    if (!canMutate || offline) return;
    setPendingTripId(trip.id);
    setActionError(null);
    const outcome = await write.transition(
      trip,
      transitionPayload(action),
      action,
    );
    setPendingTripId(null);
    if (outcome.status === "done") focusAfterAction(trip.id, origin);
    if (outcome.status === "error") {
      const copy = tripWriteCopy(outcome.error, "change");
      setActionError({
        tripId: trip.id,
        origin,
        error: outcome.error,
        title: copy.title,
        detail: copy.detail,
        retry: () => void runAction(trip, action, origin),
      });
      return;
    }
    setActionError(null);
  }

  function handleAction(
    trip: Trip,
    action: TripAction,
    origin: "row" | "detail",
  ): void {
    if (action === "assign" && !trip.driver_id) {
      setAssignTrip({ trip, origin });
      return;
    }
    if (action === "complete" || action === "cancel") {
      setConfirm({ trip, action, origin });
      return;
    }
    void runAction(trip, action, origin);
  }

  const rowActionError: TripActionError | null =
    actionError && actionError.origin === "row"
      ? {
          tripId: actionError.tripId,
          error: actionError.error,
          title: actionError.title,
          detail: actionError.detail,
          onRetry: actionError.retry,
        }
      : null;

  return (
    <PageFrame layout="fill">
      <div
        data-testid="trips-page"
        className="text-text relative flex h-full min-h-0 w-full flex-col px-4 py-6 sm:px-6"
      >
        <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-text text-lg font-semibold">Trips</h1>
            <p className="text-muted text-sm">
              <span className="tabular-nums">
                {formatCount(feed.loadedCount)}
              </span>{" "}
              loaded
            </p>
          </div>
          <Button
            ref={createRef}
            variant="primary"
            data-create-trip
            {...(createReason ? { disabledReason: createReason } : {})}
            onClick={() => setCreateOpen(true)}
          >
            Create trip
          </Button>
        </header>

        <TripFilters
          values={filters}
          onChange={changeFilters}
          onReset={resetFilters}
          className="shrink-0"
        />

        <TripTable
          trips={trips}
          state={state}
          error={closedError}
          onRetry={feed.refetch}
          onCancelLoading={feed.cancel}
          onOpen={openTrip}
          onAction={(trip, action) => handleAction(trip, action, "row")}
          pendingId={pendingTripId}
          disabledReason={changeReason}
          hasMore={feed.hasMore}
          loadingMore={feed.isFetchingNextPage}
          onLoadMore={feed.loadMore}
          emptyReason={emptyReason}
          onClearFilters={resetFilters}
          hasLoadedRows={feed.loadedCount > 0}
          actionError={rowActionError}
          {...(offline && feed.dataUpdatedAt
            ? { staleLabel: formatClockTime(feed.dataUpdatedAt) }
            : {})}
          offline={offline}
          cancelled={feed.cancelled}
          forbiddenAction={
            <Link
              to="/map"
              className="h-touch text-accent-fg md:h-control-md inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
            >
              Go back
            </Link>
          }
          resetKey={`${JSON.stringify(filters)}:${createScrollReset}`}
        />

        <TripCreateDialog
          open={createOpen}
          knownTripIds={new Set(feed.trips.map((trip) => trip.id))}
          {...(createReason ? { disabledReason: createReason } : {})}
          onCreated={afterCreate}
          onClose={() => setCreateOpen(false)}
        />

        <TripAssignDriverDialog
          key={assignTrip?.trip.id ?? "none"}
          open={assignTrip !== null}
          trip={assignTrip?.trip ?? null}
          {...(changeReason ? { disabledReason: changeReason } : {})}
          onClose={() => setAssignTrip(null)}
          onFinished={() => {
            const current = assignTrip;
            setAssignTrip(null);
            if (current) focusAfterAction(current.trip.id, current.origin);
          }}
        />

        <TripConfirmDialog
          open={confirm !== null}
          trip={confirm?.trip ?? null}
          action={confirm?.action ?? "complete"}
          {...(changeReason ? { disabledReason: changeReason } : {})}
          onClose={() => setConfirm(null)}
          onFinished={() => {
            const current = confirm;
            setConfirm(null);
            if (current) focusAfterAction(current.trip.id, current.origin);
          }}
        />

        {selectedId ? (
          <TripDetailPanel
            trip={selectedTrip}
            lookup={lookupState}
            lookupError={lookup.error ? normalize(lookup.error) : null}
            offline={offline}
            pending={pendingTripId === selectedId}
            disabledReason={changeReason}
            actionError={
              actionError?.origin === "detail" &&
              actionError.tripId === selectedId
                ? {
                    error: actionError.error,
                    title: actionError.title,
                    detail: actionError.detail,
                    onRetry: actionError.retry,
                  }
                : null
            }
            onAction={(action) => {
              if (!selectedTrip) return;
              handleAction(selectedTrip, action, "detail");
            }}
            onRetryLookup={() => void lookup.refetch()}
            onClose={closeTrip}
            returnFocus={() => focusRow(selectedId)}
          />
        ) : null}
      </div>
    </PageFrame>
  );
}
