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
        <h3 id="alert-evidence-heading" className="text-text text-sm font-medium">
          Evidence
        </h3>
        {hasEvidence ? (
          <button
            type="button"
            aria-pressed={raw}
            onClick={() => setRaw((value) => !value)}
            className="h-touch text-accent-fg hover:bg-surface-2 focus-visible:outline-focus-ring md:h-control-sm rounded-sm px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-0"
          >
            {raw ? "Readable view" : "Raw JSON"}
          </button>
        ) : null}
      </div>

      {raw ? (
        /* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- focusable so a keyboard user can scroll the raw JSON (axe scrollable-region-focusable) */
        <pre
          tabIndex={0}
          aria-label="Raw evidence JSON"
          className="border-border bg-surface-2 text-text max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs"
        >
          {JSON.stringify(evidence, null, 2)}
        </pre>
      ) : (
        <EvidenceList evidence={evidence} />
      )}
    </section>
  );
}
