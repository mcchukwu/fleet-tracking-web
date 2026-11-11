import { summaryLabel, type HealthSummary } from "../lib/health";
import { HealthDot } from "./HealthDot";

export function SystemSummary({ summary }: { summary: HealthSummary }) {
  return (
    <output data-health-summary className="flex items-center gap-2">
      <HealthDot tone={summary.tone} label="System" />
      <p className="text-text text-sm font-medium">{summaryLabel(summary)}</p>
    </output>
  );
}
