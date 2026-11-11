import { ChevronDown } from "lucide-react";
import type { Ref } from "react";
import { Button } from "../../../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import {
  REPORT_PRESETS,
  reportPresetLabel,
  type ReportPresetId,
} from "../lib/range";

export interface ReportsRangePickerProps {
  preset: ReportPresetId | null;
  onPreset: (preset: ReportPresetId) => void;
  onCustom: () => void;
  triggerRef?: Ref<HTMLButtonElement>;
}

export function ReportsRangePicker({
  preset,
  onPreset,
  onCustom,
  triggerRef,
}: ReportsRangePickerProps) {
  const label = reportPresetLabel(preset);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          size="md"
          variant="secondary"
          aria-label={`Range, ${label}`}
          className="min-w-0 shrink-0 justify-start gap-1"
        >
          <span className="truncate">{label}</span>
          <ChevronDown
            aria-hidden="true"
            className="text-subtle size-4 shrink-0"
            strokeWidth={1.5}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionPadding={12} className="min-w-56">
        <DropdownMenuLabel>Range</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preset ?? undefined}
          onValueChange={(value) => {
            const match = REPORT_PRESETS.find((option) => option.id === value);
            if (match) onPreset(match.id);
          }}
        >
          {REPORT_PRESETS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCustom}>Custom range…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
