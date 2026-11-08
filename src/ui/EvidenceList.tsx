import { formatEvidenceValue, humanizeEvidenceKey } from "../lib/evidence";
import { CopyButton } from "./CopyButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EvidenceListProps {
  evidence: Record<string, unknown>;
}

/** Evidence is free-form and untrusted: render it as text, never as HTML. */
export function EvidenceList({ evidence }: EvidenceListProps) {
  const entries = Object.entries(evidence);
  if (entries.length === 0) {
    return <p className="text-xs text-muted">No evidence recorded.</p>;
  }

  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="truncate text-muted" title={key}>
            {humanizeEvidenceKey(key)}
          </dt>
          <dd className="min-w-0 break-words font-mono text-text">
            {typeof value === "string" && UUID.test(value) ? (
              <CopyButton
                inline
                value={value}
                label={humanizeEvidenceKey(key)}
                className="max-w-full text-xs break-all"
              />
            ) : (
              formatEvidenceValue(key, value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
