import { Loader2, Map as MapIcon } from "lucide-react";
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
import { isHostedMapStyle, MAP_STYLE_LABELS, MAP_STYLE_OFFLINE_REASON } from "../lib/styles";

export interface MapStyleMenuProps {
  styles: readonly MapStyleId[];
  value: MapStyleId;
  offline: boolean;
  loadingStyle?: MapStyleId | null;
  onChange: (id: MapStyleId) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "ghost" | "secondary";
}

export function MapStyleMenu({
  styles,
  value,
  offline,
  loadingStyle = null,
  onChange,
  open,
  onOpenChange,
  variant = "secondary",
}: MapStyleMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const loading = loadingStyle !== null;

  return (
    <DropdownMenu open={isOpen} modal={false} onOpenChange={onOpenChange ?? setUncontrolledOpen}>
      <DropdownMenuTrigger asChild>
        <IconButton
          size="lg"
          label="Map style"
          variant={variant}
          aria-busy={loading}
          icon={
            loading ? (
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
                strokeWidth={1.5}
              />
            ) : (
              <MapIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
            )
          }
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="left" className="w-56">
        <DropdownMenuLabel>Map style</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          aria-label="Map style"
          onValueChange={(next) => {
            if (next === "standard" || next === "streets" || next === "satellite") {
              onChange(next);
            }
          }}
        >
          {styles.map((id) => {
            const disabled = offline && isHostedMapStyle(id);
            return (
              <DropdownMenuRadioItem key={id} value={id} disabled={disabled}>
                <span className="flex-1">{MAP_STYLE_LABELS[id]}</span>
                {disabled ? (
                  <span className="text-muted text-xs">{MAP_STYLE_OFFLINE_REASON}</span>
                ) : null}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
