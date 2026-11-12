import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { Driver } from "../../../api/types";
import type { DriversSearch } from "../../../app/search";
import { useCanMutate } from "../../../auth/useCanMutate";
import { normalize } from "../../../errors/normalize";
import { formatClockTime, formatCount } from "../../../lib/format";
import {
  filterDrivers,
  sortDrivers,
  type DriverStatus,
} from "../../../lib/drivers";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useConnection } from "../../../stores/connection";
import { Button } from "../../../ui/Button";
import { PageFrame } from "../../../ui/PageFrame";
import type { StateBoundaryState } from "../../../ui/StateBoundary";
import { DriverCreateDialog } from "./DriverCreateDialog";
import { DriverDrawer, type DriverLookupState } from "./DriverDrawer";
import { DriverEditDialog } from "./DriverEditDialog";
import { DriverFilters, type DriverFilterValues } from "./DriverFilters";
import { DriverTable, type DriverEmptyReason } from "./DriverTable";
import { useDriverFeed } from "../hooks/useDriverFeed";

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "drivers";

export function DriversPage() {
  if (INJECT_CRASH) throw new Error("Injected drivers crash");
  return <DriversPageContent />;
}

function DriversPageContent() {
  const search = useSearch({ from: "/_app/drivers" });
  const navigate = useNavigate();
  const mutate = useCanMutate("mutate");
  const { network } = useConnection();
  const offline = network === "offline";
  const createRef = useRef<HTMLButtonElement>(null);

  const filters = useMemo<DriverFilterValues>(
    () => ({
      status: (search.status ?? null) as DriverStatus | null,
      q: search.q ?? "",
    }),
    [search.status, search.q],
  );

  const feed = useDriverFeed();
  const visible = useMemo(
    () => sortDrivers(filterDrivers(feed.drivers, filters.q, filters.status)),
    [feed.drivers, filters.q, filters.status],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createScrollReset, setCreateScrollReset] = useState(0);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  useDocumentTitle("Drivers");

  const selectedId = search.driver ?? null;
  const selectedDriver = selectedId
    ? (feed.drivers.find((driver) => driver.id === selectedId) ?? null)
    : null;

  const filtered = filters.status !== null || filters.q.trim() !== "";
  const closedError = !offline && feed.error ? normalize(feed.error) : null;
  const state: StateBoundaryState =
    closedError?.kind === "forbidden"
      ? "forbidden"
      : feed.isLoading && feed.drivers.length === 0
        ? "loading"
        : closedError
          ? "error"
          : offline && visible.length > 0
            ? "stale"
            : visible.length === 0
              ? "empty"
              : "ready";

  const emptyReason: DriverEmptyReason | null =
    visible.length > 0
      ? null
      : filtered
        ? "no-results"
        : feed.drivers.length === 0 && !offline
          ? "no-data"
          : null;

  const lookup: DriverLookupState =
    selectedId === null || selectedDriver
      ? "ready"
      : feed.isLoading
        ? "loading"
        : offline
          ? "offline"
          : feed.error
            ? "error"
            : "not-found";

  const staleLabel =
    feed.drivers.length > 0 &&
    (offline || state === "error") &&
    feed.dataUpdatedAt
      ? formatClockTime(feed.dataUpdatedAt)
      : undefined;

  const createReason =
    mutate.blockedBy === "role"
      ? "Your role can't create drivers."
      : (mutate.reason ?? undefined);
  const editReason =
    mutate.blockedBy === "role"
      ? "Your role can't edit drivers."
      : (mutate.reason ?? undefined);

  function updateSearch(patch: Partial<DriversSearch>, replace = true): void {
    void navigate({ to: "/drivers", search: { ...search, ...patch }, replace });
  }

  function changeFilters(patch: Partial<DriverFilterValues>): void {
    const next: Partial<DriversSearch> = {};
    if ("status" in patch) next.status = patch.status ?? undefined;
    if ("q" in patch) next.q = patch.q ?? undefined;
    updateSearch(next);
  }

  function resetFilters(): void {
    updateSearch({ status: undefined, q: undefined });
  }

  function focusRow(id: string | null): void {
    setTimeout(() => {
      if (id) {
        const target = document.querySelector<HTMLElement>(
          `[data-driver-id="${CSS.escape(id)}"]`,
        );
        if (target) {
          target.focus();
          return;
        }
      }
      createRef.current?.focus();
    }, 0);
  }

  function focusDrawerAction(): void {
    setTimeout(() => {
      const action = document.querySelector<HTMLElement>(
        '[data-testid="drawer"] [data-detail-action]',
      );
      if (action) {
        action.focus();
        return;
      }
      createRef.current?.focus();
    }, 0);
  }

  function openDriver(id: string): void {
    updateSearch({ driver: id }, false);
  }

  function closeDriver(): void {
    updateSearch({ driver: undefined });
  }

  function afterCreate(): void {
    updateSearch({ status: undefined, q: undefined, driver: undefined });
    setCreateScrollReset((value) => value + 1);
    setTimeout(() => createRef.current?.focus(), 0);
  }

  /** After a 404 refresh, close the stale form if the row is gone from the list. */
  async function refreshEditTarget(): Promise<void> {
    const rows = await feed.refetch();
    if (
      rows &&
      editDriver &&
      !rows.some((driver) => driver.id === editDriver.id)
    ) {
      setEditDriver(null);
    }
  }

  return (
    <PageFrame layout="fill">
      <div
        data-testid="drivers-page"
        className="text-text relative flex h-full min-h-0 w-full flex-col px-4 py-6 sm:px-6"
      >
        <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-text text-lg font-semibold">Drivers</h1>
            <p className="text-muted text-sm">
              <span className="tabular-nums">
                {formatCount(visible.length)}
              </span>
              {filtered ? (
                <>
                  {" of "}
                  <span className="tabular-nums">
                    {formatCount(feed.drivers.length)}
                  </span>{" "}
                  drivers
                </>
              ) : (
                " drivers"
              )}
            </p>
          </div>
          <Button
            ref={createRef}
            variant="primary"
            data-create-driver
            {...(createReason ? { disabledReason: createReason } : {})}
            onClick={() => setCreateOpen(true)}
          >
            Create driver
          </Button>
        </header>

        <DriverFilters
          values={filters}
          onChange={changeFilters}
          onReset={resetFilters}
          className="shrink-0"
        />

        <DriverTable
          drivers={visible}
          state={state}
          error={closedError}
          onRetry={() => void feed.refetch()}
          onCancelLoading={feed.cancel}
          onOpen={openDriver}
          emptyReason={emptyReason}
          onClearFilters={resetFilters}
          hasDrivers={feed.drivers.length > 0}
          {...(staleLabel ? { staleLabel } : {})}
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

        <DriverCreateDialog
          open={createOpen}
          knownDriverIds={new Set(feed.drivers.map((driver) => driver.id))}
          {...(createReason ? { disabledReason: createReason } : {})}
          onCreated={afterCreate}
          onClose={() => setCreateOpen(false)}
        />

        <DriverEditDialog
          key={editDriver?.id ?? "none"}
          open={editDriver !== null}
          driver={editDriver}
          {...(editReason ? { disabledReason: editReason } : {})}
          onSaved={focusDrawerAction}
          onClose={() => setEditDriver(null)}
          onRefresh={() => void refreshEditTarget()}
        />

        {selectedId ? (
          <DriverDrawer
            driver={selectedDriver}
            lookup={lookup}
            lookupError={closedError}
            offline={offline}
            {...(editReason ? { disabledReason: editReason } : {})}
            onEdit={() => {
              if (selectedDriver) setEditDriver(selectedDriver);
            }}
            onClose={closeDriver}
            onRetryLookup={() => void feed.refetch()}
            returnFocus={() => focusRow(selectedId)}
          />
        ) : null}
      </div>
    </PageFrame>
  );
}
