import type { ReactNode } from "react";
import type { AuditEntry } from "../../../api/types";
import { ErrorState } from "../../../errors/ErrorState";
import type { AppError } from "../../../errors/types";
import { MISSING } from "../../../lib/format";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CopyButton } from "../../../ui/CopyButton";
import { Drawer } from "../../../ui/Drawer";
import { EvidenceList } from "../../../ui/EvidenceList";
import { Skeleton } from "../../../ui/StatePanel";
import { Timestamp } from "../../../ui/Timestamp";
import { auditActionLabel, auditEntityLabel } from "../lib/audit";

export type AuditLookupState = "loading" | "ready" | "not-found" | "error" | "offline";

export interface AuditDetailPanelProps {
  entry: AuditEntry | null;
  lookup: AuditLookupState;
  lookupError?: AppError | null;
  onClose: () => void;
  onRetryLookup: () => void;
  returnFocus?: () => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-muted shrink-0 text-xs">{label}</dt>
      <dd className="text-text min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

export function AuditDetailPanel(props: AuditDetailPanelProps) {
  if (!props.entry) return <MissingAuditPanel {...props} />;
  return <ResolvedAuditDetail {...props} entry={props.entry} />;
}

function MissingAuditPanel({
  lookup,
  lookupError,
  onClose,
  onRetryLookup,
  returnFocus,
}: AuditDetailPanelProps) {
  return (
    <Drawer
      open
      placement="page"
      label="Audit entry details"
      title="Audit entry"
      titleClassName="font-sans"
      closeLabel="Close audit entry"
      onClose={onClose}
      returnFocus={returnFocus}
    >
      {lookup === "loading" ? (
        <div aria-busy="true" aria-label="Loading audit entry" className="space-y-3 p-4">
          <Skeleton className="w-2/3" />
          <Skeleton className="w-1/2" />
          <Skeleton className="w-full" />
        </div>
      ) : lookup === "error" && lookupError ? (
        <ErrorState error={lookupError} onRetry={onRetryLookup} className="py-8" />
      ) : lookup === "offline" ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-text text-base font-medium">Audit entry isn't available offline</p>
          <p className="text-muted text-sm">
            Reconnect to open this entry. It isn't stored on this device.
          </p>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-text text-base font-medium">Audit entry not found</p>
          <p className="text-muted text-sm">It may be older than the 500 most recent entries.</p>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </Drawer>
  );
}

function ResolvedAuditDetail({
  entry,
  onClose,
  returnFocus,
}: AuditDetailPanelProps & { entry: AuditEntry }) {
  const hasMetadata = Object.keys(entry.metadata).length > 0;

  return (
    <Drawer
      open
      placement="page"
      label="Audit entry details"
      title={auditActionLabel(entry.action)}
      titleClassName="font-sans"
      headerAside={<Badge tone="neutral">{auditEntityLabel(entry.entity)}</Badge>}
      closeLabel="Close audit entry"
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <div className="flex flex-col gap-4 p-4">
        <section aria-labelledby="audit-summary-heading">
          <h3 id="audit-summary-heading" className="text-text mb-1 text-sm font-medium">
            Summary
          </h3>
          <dl>
            <Field label="Actor">{entry.user_name || MISSING}</Field>
            <Field label="Action">
              <span className="font-mono text-xs">{entry.action || MISSING}</span>
            </Field>
            <Field label="Entity">{auditEntityLabel(entry.entity)}</Field>
            <Field label="Time">
              <Timestamp iso={entry.created_at} className="text-sm" />
            </Field>
          </dl>
        </section>

        <section aria-labelledby="audit-identifiers-heading">
          <h3 id="audit-identifiers-heading" className="text-text mb-1 text-sm font-medium">
            Identifiers
          </h3>
          <dl>
            <Field label="Entry ID">
              <CopyButton inline value={String(entry.id)} label="entry id" className="text-xs" />
            </Field>
            <Field label="Entity ID">
              {entry.entity_id ? (
                <CopyButton
                  inline
                  value={entry.entity_id}
                  label="entity id"
                  className="text-xs break-all"
                />
              ) : (
                MISSING
              )}
            </Field>
          </dl>
        </section>

        <section aria-labelledby="audit-details-heading">
          <h3 id="audit-details-heading" className="text-text mb-1 text-sm font-medium">
            Details
          </h3>
          {hasMetadata ? (
            <EvidenceList evidence={entry.metadata} />
          ) : (
            <p className="text-muted text-sm">No details recorded.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
