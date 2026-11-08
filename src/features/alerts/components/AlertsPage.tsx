import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { OPEN_ALERT_LIMIT, useAlertLookup, useOpenAlerts } from "../../../api/hooks/alerts";
import { useGeofences } from "../../../api/hooks/geofences";
import type { Alert } from "../../../api/types";
import { useCan } from "../../../auth/useCan";
import type { AlertsSearch } from "../../../app/search";
import { normalize } from "../../../errors/normalize";
import { formatClockTime } from "../../../lib/format";
import { openAlertCountLabel } from "../../../lib/alerts";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useConnection } from "../../../stores/connection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../ui/Tabs";
import type { StateBoundaryState } from "../../../ui/StateBoundary";
import { useAlertAck } from "../hooks/useAlertAck";
import { useAlertFeed } from "../hooks/useAlertFeed";
import {
  alertTypeOptions,
  emptyReason,
  filterAlerts,
  filterSignature,
  type AlertFilterValues,
} from "../lib/filter";
import { AlertFilters } from "./AlertFilters";
import { AlertTable } from "./AlertTable";
import { AlertDetailPanel, type AlertLookupState } from "./AlertDetailPanel";
import { AlertRulesPanel } from "./AlertRulesPanel";

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "alerts";

export function AlertsPage() {
  if (INJECT_CRASH) throw new Error("Injected alerts crash");
  return <AlertsPageContent />;
}

function AlertsPageContent() {
  const search = useSearch({ from: "/_app/alerts" });
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [ackOrigin, setAckOrigin] = useState<"row" | "detail">("row");
  const { network, lastDataAt } = useConnection();
  const offline = network === "offline";
  const canAck = useCan("ack");
  const openAlerts = useOpenAlerts();
  const geofences = useGeofences();
  const ack = useAlertAck({ canAck });

  const tab = search.tab ?? "alerts";
  const filters = useMemo<AlertFilterValues>(
    () => ({
      status: search.status ?? null,
      type: search.type ?? null,
      severity: search.severity ?? null,
      q: search.q ?? "",
    }),
    [search.status, search.type, search.severity, search.q],
  );

  const feed = useAlertFeed(filters);
  const alerts = useMemo(() => filterAlerts(feed.visible, filters), [feed.visible, filters]);
  const types = useMemo(
    () => alertTypeOptions(feed.visible, filters.type),
    [feed.visible, filters.type],
  );

  const selectedId = tab === "alerts" ? (search.alert ?? null) : null;
  const selectedInFeed = selectedId
    ? (feed.visible.find((alert) => alert.id === selectedId) ?? null)
    : null;
  const lookup = useAlertLookup(
    selectedId,
    selectedId !== null && selectedInFeed === null && !feed.isLoading,
  );
  const selectedAlert = selectedInFeed ?? lookup.data ?? null;
  const lookupState: AlertLookupState =
    selectedId === null
      ? "ready"
      : selectedInFeed
        ? "ready"
        : feed.isLoading || lookup.isPending
          ? "loading"
          : lookup.error
            ? "error"
            : lookup.data
              ? "ready"
              : "not-found";

  const geofenceNames = useMemo(
    () => new Map((geofences.data ?? []).map((geofence) => [geofence.id, geofence.name])),
    [geofences.data],
  );

  const openCount = openAlerts.data ? openAlerts.data.length : undefined;
  const openLabel = openAlertCountLabel(openCount, OPEN_ALERT_LIMIT);
  const openError = openAlerts.error ? normalize(openAlerts.error) : null;
  useDocumentTitle("Alerts", openAlerts.data ? openLabel : undefined);

  const signature = filterSignature(filters);
  useEffect(() => {
    pageRef.current?.closest("main")?.scrollTo({ top: 0, behavior: "auto" });
  }, [signature]);

  const closedError = !offline && feed.error ? normalize(feed.error) : null;
  const state: StateBoundaryState =
    closedError?.kind === "forbidden"
      ? "forbidden"
      : feed.isLoading && alerts.length === 0
        ? "loading"
        : closedError
          ? "error"
          : offline && alerts.length > 0
            ? "stale"
            : alerts.length === 0
              ? "empty"
              : "ready";

  const reason = emptyReason({
    values: filters,
    serverCount: feed.loadedCount,
    clientCount: alerts.length,
    hasMore: feed.hasMore,
  });

  const disabledReason = !canAck
    ? "Viewers can't acknowledge alerts."
    : offline
      ? "You're offline."
      : undefined;

  function updateSearch(
    patch: Partial<AlertsSearch>,
    replace = true,
  ): void {
    void navigate({
      to: "/alerts",
      search: { ...search, ...patch },
      replace,
    });
  }

  function changeFilters(patch: Partial<AlertFilterValues>): void {
    const next: Partial<AlertsSearch> = {};
    if ("status" in patch) next.status = patch.status ?? undefined;
    if ("type" in patch) next.type = patch.type ?? undefined;
    if ("severity" in patch) next.severity = patch.severity ?? undefined;
    if ("q" in patch) next.q = patch.q ?? undefined;
    updateSearch(next);
  }

  function resetFilters(): void {
    updateSearch({
      status: undefined,
      type: undefined,
      severity: undefined,
      q: undefined,
    });
  }

  function changeTab(value: string): void {
    updateSearch({
      tab: value === "rules" ? "rules" : undefined,
      alert: undefined,
    });
    setTimeout(() => {
      document.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.focus();
    }, 0);
  }

  function openAlert(id: string): void {
    updateSearch({ alert: id, tab: undefined }, false);
  }

  function closeAlert(): void {
    updateSearch({ alert: undefined });
  }

  function focusRow(id: string | null): void {
    setTimeout(() => {
      if (id) {
        const target = document.querySelector<HTMLElement>(
          `[data-alert-id="${CSS.escape(id)}"]`,
        );
        if (target) {
          target.focus();
          return;
        }
      }
      document.querySelector<HTMLElement>('[data-testid="alerts-page"] select')?.focus();
    }, 0);
  }

  function focusAfterAck(index: number): void {
    setTimeout(() => {
      const rows = document.querySelectorAll<HTMLElement>("[data-alert-row]");
      const next = rows[Math.min(index, rows.length - 1)];
      if (next) {
        next.focus();
        return;
      }
      document.querySelector<HTMLElement>('[data-testid="alerts-page"] select')?.focus();
    }, 0);
  }

  async function acknowledge(alert: Alert, origin: "row" | "detail"): Promise<void> {
    setAckOrigin(origin);
    const index = alerts.findIndex((row) => row.id === alert.id);
    const outcome = await ack.acknowledge(alert);
    if (origin === "row" && (outcome === "acked" || outcome === "already_acked" || outcome === "gone")) {
      focusAfterAck(index);
    }
  }

  function revealNew(): void {
    const scroller = pageRef.current?.closest("main");
    scroller?.scrollTo({ top: 0, behavior: "auto" });
    feed.revealNew();
  }

  function zoneFor(alert: Alert): string | null {
    const id = alert.evidence.geofence_id;
    if (typeof id !== "string") return null;
    return geofenceNames.get(id) ?? "Unknown zone";
  }

  function tripFor(alert: Alert): string | null {
    return alert.trip_id ?? null;
  }

  return (
    <div
      ref={pageRef}
      data-testid="alerts-page"
      className="relative mx-auto flex min-h-full w-full max-w-content flex-col px-4 py-6 text-text sm:px-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-text">Alerts</h1>
          <p className="text-sm text-muted">
            <span className="tabular-nums">{openLabel}</span> open ·{" "}
            <span className="tabular-nums">{feed.loadedCount}</span> loaded
            {openError ? (
              <span className="text-xs">
                {" "}
                · Count unavailable ·{" "}
                <button
                  type="button"
                  onClick={() => void openAlerts.refetch()}
                  className="rounded-sm text-accent-fg underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
                >
                  Retry count
                </button>
              </span>
            ) : null}
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={changeTab} className="mt-4">
        <TabsList aria-label="Alerts sections">
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="rules">Alert rules</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <AlertFilters
            values={filters}
            typeOptions={types}
            onChange={changeFilters}
            onReset={resetFilters}
            disabled={tab !== "alerts"}
          />
          <AlertTable
            alerts={alerts}
            state={state}
            error={closedError}
            onRetry={feed.refetch}
            onCancelLoading={feed.cancel}
            onOpen={openAlert}
            onAck={(alert) => void acknowledge(alert, "row")}
            pendingId={ack.pendingId}
            disabledReason={disabledReason}
            hasMore={feed.hasMore}
            loadingMore={feed.isFetchingNextPage}
            onLoadMore={feed.loadMore}
            newCount={feed.newCount}
            onRevealNew={revealNew}
            highlightIds={feed.highlightIds}
            emptyReason={reason}
            onClearFilters={resetFilters}
            zoneFor={zoneFor}
            tripFor={tripFor}
            onScrollTopChange={feed.setAtTop}
            ackError={ackOrigin === "row" ? ack.error : null}
            offline={offline}
            staleLabel={lastDataAt ? formatClockTime(lastDataAt) : undefined}
            forbiddenAction={
              <Link
                to="/map"
                className="inline-flex h-touch items-center text-sm font-medium text-accent-fg underline-offset-4 hover:underline md:h-control-md"
              >
                Go back
              </Link>
            }
          />
        </TabsContent>

        <TabsContent value="rules">
          <AlertRulesPanel />
        </TabsContent>
      </Tabs>

      {selectedId ? (
        <AlertDetailPanel
          alert={selectedAlert}
          lookup={lookupState}
          lookupError={lookup.error ? normalize(lookup.error) : null}
          geofences={geofences.data ?? []}
          offline={offline}
          pending={ack.pendingId === selectedId}
          disabledReason={disabledReason}
          ackError={ackOrigin === "detail" ? ack.error : null}
          onClose={closeAlert}
          onAck={() => {
            if (selectedAlert) void acknowledge(selectedAlert, "detail");
          }}
          onRetryLookup={() => void lookup.refetch()}
          returnFocus={() => focusRow(selectedId)}
        />
      ) : null}
    </div>
  );
}
