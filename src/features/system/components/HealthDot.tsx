// oxlint-disable jsx-a11y/prefer-tag-over-role -- A tinted status dot has no image source; role="img" gives the status an accessible name.
import { Check, OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "../../../ui/cn";
import { toneLabel, type HealthTone } from "../lib/health";

const toneClasses: Record<HealthTone, string> = {
  healthy: "bg-moving-bg text-moving-fg",
  warning: "bg-idle-bg text-idle-fg",
  critical: "bg-alert-bg text-alert-fg",
};

const toneIcons: Record<HealthTone, typeof Check> = {
  healthy: Check,
  warning: TriangleAlert,
  critical: OctagonAlert,
};

export interface HealthDotProps {
  tone: HealthTone;
  label: string;
}

export function HealthDot({ tone, label }: HealthDotProps) {
  const Icon = toneIcons[tone];
  return (
    <span
      role="img"
      aria-label={`${label}: ${toneLabel(tone)}`}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full",
        toneClasses[tone],
      )}
    >
      <Icon aria-hidden="true" className="size-3" strokeWidth={2} />
    </span>
  );
}
