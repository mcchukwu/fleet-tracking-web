import { Map as MapIcon } from "lucide-react";
import { useState } from "react";
import type { MapStyleId } from "../../../map/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import { IconButton } from "../../../ui/IconButton";

export interface MapStyleMenuProps {
  styles: readonly MapStyleId[];
  value: MapStyleId;
  offline: boolean;
  onChange: (id: MapStyleId) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "ghost" | "secondary";
}

const LABELS: Record<MapStyleId, string> = {
  standard: "Map",
  satellite: "Satellite",
};

export function MapStyleMenu({
  styles,
  value,
  offline,
  onChange,
  open,
  onOpenChange,
  variant = "secondary",
}: MapStyleMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange ?? setUncontrolledOpen}>
      <DropdownMenuTrigger asChild>
        <IconButton
          size="lg"
          label="Map style"
          variant={variant}
          icon={<MapIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="left" className="w-48">
        <DropdownMenuLabel>Map style</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          aria-label="Map style"
          onValueChange={(next) => {
            if (next === "standard" || next === "satellite") onChange(next);
          }}
        >
          {styles.map((id) => {
            const disabled = id === "satellite" && offline;
            return (
              <DropdownMenuRadioItem key={id} value={id} disabled={disabled}>
                <span className="flex-1">{LABELS[id]}</span>
                {disabled ? (
                  <span className="text-xs text-muted">Satellite needs a connection</span>
                ) : null}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
