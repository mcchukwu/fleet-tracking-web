import { useState } from "react";
import { EvidenceList } from "../../../ui/EvidenceList";

export interface AlertEvidenceSectionProps {
  evidence: Record<string, unknown>;
}

export function AlertEvidenceSection({ evidence }: AlertEvidenceSectionProps) {
  const [raw, setRaw] = useState(false);
  const hasEvidence = Object.keys(evidence).length > 0;

  return (
    <section aria-labelledby="alert-evidence-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id="alert-evidence-heading" className="text-sm font-medium text-text">
          Evidence
        </h3>
        {hasEvidence ? (
          <button
            type="button"
            aria-pressed={raw}
            onClick={() => setRaw((value) => !value)}
            className="h-touch rounded-sm px-2 text-xs font-medium text-accent-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:h-control-sm"
          >
            {raw ? "Readable view" : "Raw JSON"}
          </button>
        ) : null}
      </div>

      {raw ? (
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-xs text-text">
          {JSON.stringify(evidence, null, 2)}
        </pre>
      ) : (
        <EvidenceList evidence={evidence} />
      )}
    </section>
  );
}
