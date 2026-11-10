import { ChevronDown } from "lucide-react";
import type { Ref } from "react";
import { Button } from "../../../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import { RANGE_PRESETS, type RangePresetId } from "../lib/constants";

const shortLabel: Record<RangePresetId, string> = {
  "30m": "30 min",
  "2h": "2 h",
  "6h": "6 h",
  "24h": "24 h",
};

export interface PlaybackRangeMenuProps {
  preset: RangePresetId | null;
  onPreset: (preset: RangePresetId) => void;
  onCustomRange: () => void;
  triggerRef?: Ref<HTMLButtonElement>;
}

export function PlaybackRangeMenu({
  preset,
  onPreset,
  onCustomRange,
  triggerRef,
}: PlaybackRangeMenuProps) {
  const label = preset ? shortLabel[preset] : "Custom";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          size="md"
          variant="ghost"
          aria-label={`Range, ${label}`}
          className="min-w-0 shrink-0 justify-start gap-1 px-2"
        >
          <span className="truncate">{label}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-subtle"
            strokeWidth={1.5}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionPadding={12} className="min-w-56">
        <DropdownMenuLabel>Range</DropdownMenuLabel>
        {RANGE_PRESETS.map((option) => (
          <DropdownMenuItem key={option.id} onSelect={() => onPreset(option.id)}>
            {option.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={onCustomRange}>Custom…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
