import { useState } from "react";
import { useAlerts } from "../api/hooks/alerts";
import { useSystemHealth } from "../api/hooks/system";
import { api } from "../api/instance";
import { ErrorBoundary } from "../errors/ErrorBoundary";
import { InlineError } from "../errors/InlineError";
import { normalize } from "../errors/normalize";
import { useActionError } from "../errors/useActionError";
import { alertTypeLabel } from "../lib/status";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { alertsFixture } from "../mocks/fixtures/alerts";
import { Button } from "../ui/Button";
import { PageFrame } from "../ui/PageFrame";
import { StateBoundary, type StateBoundaryState } from "../ui/StateBoundary";

const firstAlertId = alertsFixture[0]?.id ?? "alert-1";

function CrashPanel() {
  const [crashed, setCrashed] = useState(false);
  if (crashed) throw new Error("Injected panel crash");
  return <Button onClick={() => setCrashed(true)}>Crash this panel</Button>;
}

function AlertsPanel() {
  const alerts = useAlerts();
  const rows = Array.isArray(alerts.data) ? alerts.data : [];
  const state: StateBoundaryState = alerts.isLoading
    ? "loading"
    : alerts.isError
      ? "error"
      : rows.length > 0
        ? "ready"
        : "empty";

  return (
    <section aria-labelledby="fault-alerts" className="flex flex-col gap-2">
      <h2 id="fault-alerts" className="text-text text-base font-medium">
        Alerts query
      </h2>
      <Button size="sm" onClick={() => void alerts.refetch()}>
        Refetch alerts
      </Button>
      <StateBoundary
        state={state}
        error={alerts.error ? normalize(alerts.error) : null}
        onRetry={() => void alerts.refetch()}
        emptyReason="no-results"
      >
        {rows.length > 0 ? (
          <ul className="text-text flex flex-col gap-1 text-sm">
            {rows.map((alert) => (
              <li key={alert.id}>
                {alert.plate} · {alertTypeLabel(alert.type)}
              </li>
            ))}
          </ul>
        ) : null}
      </StateBoundary>
    </section>
  );
}

function HealthPanel() {
  const health = useSystemHealth();
  const state: StateBoundaryState = health.isLoading
    ? "loading"
    : health.isError
      ? "error"
      : "ready";

  return (
    <section aria-labelledby="fault-health" className="flex flex-col gap-2">
      <h2 id="fault-health" className="text-text text-base font-medium">
        Health query
      </h2>
      <StateBoundary
        state={state}
        error={health.error ? normalize(health.error) : null}
        onRetry={() => void health.refetch()}
      >
        {health.data ? (
          <p className="text-text text-sm">
            {health.data.vehicles} vehicles · {health.data.open_alerts} open alerts
          </p>
        ) : null}
      </StateBoundary>
    </section>
  );
}

function WritePanel() {
  const { pending, error, run } = useActionError();

  return (
    <section aria-labelledby="fault-write" className="flex flex-col gap-2">
      <h2 id="fault-write" className="text-text text-base font-medium">
        Write action
      </h2>
      <Button
        size="sm"
        loading={pending}
        onClick={() =>
          void run(() => api.ackAlert(firstAlertId, { timeoutMs: 900 }), {
            action: "acknowledge the alert",
            resource: "alerts",
          })
        }
      >
        Acknowledge alert
      </Button>
      {error ? <InlineError error={error} /> : null}
    </section>
  );
}

export function FaultLab() {
  useDocumentTitle("Fault lab");

  return (
    <PageFrame
      layout="scroll"
      contentClassName="text-text flex flex-col gap-6 px-4 pt-4 sm:px-6 sm:pt-6"
    >
      <h1 className="text-lg font-semibold">Fault lab</h1>
      <p className="text-muted text-sm">
        Development-only page. Add ?fault=resource:kind to the URL to force failures.
      </p>

      <section aria-labelledby="fault-crash" className="flex flex-col gap-2">
        <h2 id="fault-crash" className="text-text text-base font-medium">
          Panel boundary
        </h2>
        <p>Sibling region is still working</p>
        <ErrorBoundary level="panel">
          <CrashPanel />
        </ErrorBoundary>
      </section>

      <AlertsPanel />
      <HealthPanel />
      <WritePanel />

      <section aria-labelledby="fault-enum" className="flex flex-col gap-2">
        <h2 id="fault-enum" className="text-text text-base font-medium">
          Unknown enum
        </h2>
        <p className="text-text text-sm">{alertTypeLabel("solar_flare")}</p>
      </section>
    </PageFrame>
  );
}
