import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useReportSummary } from "../../../api/hooks/reports";
import { queryKeys } from "../../../api/keys";
import type { ReportSummary } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import { SlowNotice } from "../../../errors/SlowNotice";
import { formatClockTime, formatRangeLabel } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useConnection } from "../../../stores/connection";
import { Button } from "../../../ui/Button";
import { DateRangeDialog } from "../../../ui/DateRangeDialog";
import { PageFrame } from "../../../ui/PageFrame";
import { EmptyState } from "../../../ui/StatePanel";
import {
  StateBoundary,
  type StateBoundaryState,
} from "../../../ui/StateBoundary";
import { AlertsByTypeChart } from "./AlertsByTypeChart";
import { ReportsRangePicker } from "./ReportsRangePicker";
import { ReportsSkeleton } from "./ReportsSkeleton";
import { ReportsStats } from "./ReportsStats";
import { reportsCopy } from "../lib/copy";
import {
  REPORT_PRESETS,
  activeReportsPreset,
  defaultReportsRange,
  presetReportsRange,
  validateReportsRange,
} from "../lib/range";

/** Dev-only render-crash injection for the e2e fault matrix. */
const INJECT_CRASH =
  import.meta.env.DEV &&
  import.meta.env.VITE_MOCK === "1" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("crash") === "reports";

export function ReportsPage() {
  if (INJECT_CRASH) throw new Error("Injected reports crash");
  return <ReportsPageContent />;
}

function ReportsPageContent() {
  const search = useSearch({ from: "/_app/reports" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { network } = useConnection();
  const offline = network === "offline";

  const from = search.from ?? "";
  const to = search.to ?? "";
  const key = `${from}|${to}`;
  const hasRange = Boolean(from && to);
  const validation = validateReportsRange(from || undefined, to || undefined);
  const preset = activeReportsPreset(from || undefined, to || undefined);

  const [initialRange] = useState(() => defaultReportsRange());
  const [customOpen, setCustomOpen] = useState(false);
  const [cancelledKey, setCancelledKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const defaultedRef = useRef(false);

  useDocumentTitle("Reports");

  useEffect(() => {
    if (hasRange) {
      defaultedRef.current = false;
      return;
    }
    if (defaultedRef.current) return;
    defaultedRef.current = true;
    const next = defaultReportsRange();
    void navigate({ to: "/reports", search: next, replace: true });
  }, [hasRange, navigate]);

  const query = useReportSummary(from, to, validation.valid && !offline);
  const cached = query.data !== undefined;
  const cancelled = cancelledKey === key;
  const error = !offline && query.error ? normalize(query.error) : null;
  const pendingFirstLoad =
    query.isFetching && !cached && !cancelled && hasRange;

  const state: StateBoundaryState = !hasRange
    ? "loading"
    : !validation.valid
      ? "empty"
      : error?.kind === "forbidden"
        ? "forbidden"
        : offline && !cached
          ? "empty"
          : pendingFirstLoad
            ? "loading"
            : error
              ? "error"
              : offline && cached
                ? "stale"
                : "ready";

  const staleLabel = cached ? formatClockTime(query.dataUpdatedAt) : undefined;

  function changeRange(nextFrom: string, nextTo: string): void {
    setCancelledKey(null);
    void navigate({
      to: "/reports",
      search: { from: nextFrom, to: nextTo },
      replace: true,
    });
  }

  function selectPreset(id: (typeof REPORT_PRESETS)[number]["id"]): void {
    const option = REPORT_PRESETS.find((candidate) => candidate.id === id);
    if (!option) return;
    const next = presetReportsRange(option.ms);
    changeRange(next.from, next.to);
  }

  function useLastSevenDays(): void {
    const next = defaultReportsRange();
    changeRange(next.from, next.to);
  }

  function focusTrigger(): void {
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function applyCustom(nextFrom: string, nextTo: string): void {
    setCustomOpen(false);
    changeRange(nextFrom, nextTo);
    focusTrigger();
  }

  function closeCustom(): void {
    setCustomOpen(false);
    focusTrigger();
  }

  function retry(): void {
    setCancelledKey(null);
    void query.refetch();
  }

  function cancel(): void {
    setCancelledKey(key);
    void queryClient.cancelQueries({ queryKey: queryKeys.reports(from, to) });
  }

  const data: ReportSummary | undefined = query.data;

  const content = data ? (
    <div className="flex flex-col gap-6">
      <ReportsStats summary={data} />
      <AlertsByTypeChart items={data.alerts_by_type} alertCount={data.alerts} />
    </div>
  ) : null;

  return (
    <PageFrame layout="scroll" contentClassName="px-4 pt-6 sm:px-6">
      <div
        data-testid="reports-page"
        className="text-text flex w-full flex-col gap-4"
      >
        <header className="flex flex-col gap-1">
          <h1 className="text-text text-lg font-semibold">Reports</h1>
          <p className="text-muted text-sm tabular-nums">
            {validation.valid
              ? formatRangeLabel(from, to)
              : "Fleet activity for a time range."}
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <ReportsRangePicker
            preset={preset}
            onPreset={selectPreset}
            onCustom={() => setCustomOpen(true)}
            triggerRef={triggerRef}
          />
        </div>

        {pendingFirstLoad ? (
          <SlowNotice onCancel={cancel} onRetry={retry} />
        ) : null}

        {cancelled && !cached && hasRange ? (
          <div className="border-border bg-surface flex items-center justify-between gap-2 rounded-lg border px-4 py-3">
            <p className="text-muted text-sm">{reportsCopy.loadingCancelled}</p>
            <Button size="sm" variant="ghost" onClick={retry}>
              Retry
            </Button>
          </div>
        ) : (
          <StateBoundary
            state={state}
            {...(error ? { error } : {})}
            onRetry={retry}
            loading={<ReportsSkeleton />}
            staleLabel={staleLabel}
            empty={emptyState({
              hasRange,
              valid: validation.valid,
              offline,
              onReset: useLastSevenDays,
            })}
            forbiddenAction={
              <Link
                to="/map"
                className="h-touch text-accent-fg md:h-control-md inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
              >
                Go back
              </Link>
            }
          >
            {content}
          </StateBoundary>
        )}

        <DateRangeDialog
          open={customOpen}
          from={from || initialRange.from}
          to={to || initialRange.to}
          title="Report range"
          validate={validateReportsRange}
          onApply={applyCustom}
          onClose={closeCustom}
        />
      </div>
    </PageFrame>
  );
}

function emptyState({
  hasRange,
  valid,
  offline,
  onReset,
}: {
  hasRange: boolean;
  valid: boolean;
  offline: boolean;
  onReset: () => void;
}) {
  if (hasRange && !valid) {
    return (
      <EmptyState
        title={reportsCopy.invalidRange.title}
        description={reportsCopy.invalidRange.description}
        action={
          <Button size="sm" variant="secondary" onClick={onReset}>
            {reportsCopy.invalidRange.action}
          </Button>
        }
      />
    );
  }
  if (offline) {
    return (
      <EmptyState
        title={reportsCopy.offlineEmpty.title}
        description={reportsCopy.offlineEmpty.description}
      />
    );
  }
  return undefined;
}
