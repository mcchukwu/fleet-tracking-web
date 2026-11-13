/* oxlint-disable jsx-a11y/prefer-tag-over-role -- ARIA 1.2 combobox input: the search field owns the listbox keyboard. */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { IconButton } from "./IconButton";
import { LayerPortal } from "./LayerPortal";
import { PickerList } from "./PickerList";
import { SearchField } from "./SearchField";
import type { ComboboxItem } from "./Combobox";

export const PICKER_SHEET_ROW_HEIGHT = 56;

interface VisualViewportBox {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  innerHeight: number;
}

function readVisualViewport(): VisualViewportBox {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
    offsetTop: viewport?.offsetTop ?? 0,
    offsetLeft: viewport?.offsetLeft ?? 0,
    innerHeight: window.innerHeight,
  };
}

function sheetStyle(box: VisualViewportBox): CSSProperties {
  return {
    left: box.offsetLeft,
    width: box.width,
    bottom: box.innerHeight - box.offsetTop - box.height,
    maxHeight: Math.round(box.height * 0.85),
  };
}

export interface PickerSheetProps {
  id: string;
  open: boolean;
  label: string;
  placeholder: string;
  query: string;
  onQuery: (query: string) => void;
  items: readonly ComboboxItem[];
  selectedId: string | null;
  activeIndex: number;
  onActive: (index: number) => void;
  onSelect: (item: ComboboxItem) => void;
  onClose: () => void;
  clearable?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  onRetry?: () => void;
}

/**
 * The small-screen picker: a modal dialog pinned to the bottom of the visual
 * viewport, so the software keyboard pushes it up instead of hiding it. The
 * sticky header owns the search field and a 44px close; the list is the only
 * scroll port.
 */
export function PickerSheet({
  id,
  open,
  label,
  placeholder,
  query,
  onQuery,
  items,
  selectedId,
  activeIndex,
  onActive,
  onSelect,
  onClose,
  clearable = false,
  onClear,
  clearLabel = "Clear selection",
  loading = false,
  error,
  emptyMessage,
  onRetry,
}: PickerSheetProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewport, setViewport] = useState<VisualViewportBox>(() =>
    readVisualViewport(),
  );

  useEffect(() => {
    if (!open) return;
    const update = () => setViewport(readVisualViewport());
    update();
    window.addEventListener("resize", update);
    const visual = window.visualViewport;
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
    };
  }, [open]);

  const clearOffset = clearable && onClear ? 1 : 0;
  const total = items.length + clearOffset;
  const active = total === 0 ? 0 : Math.min(activeIndex, total - 1);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (total === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onActive(Math.min(total - 1, active + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onActive(Math.max(0, active - 1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onActive(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onActive(Math.max(0, total - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (clearOffset === 1 && active === 0 && onClear) {
        onClear();
        return;
      }
      const item = items[active - clearOffset];
      if (item) onSelect(item);
    }
  }

  const activeId =
    total === 0
      ? undefined
      : clearOffset === 1 && active === 0
        ? `${listboxId}-clear`
        : items[active - clearOffset]
          ? `${listboxId}-${items[active - clearOffset]?.id}`
          : undefined;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <LayerPortal layer="popover">
        <DialogPrimitive.Overlay className="animate-fade-in bg-overlay fixed inset-0" />
        <DialogPrimitive.Content
          id={id}
          data-picker-sheet
          style={sheetStyle(viewport)}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="border-border bg-surface text-text shadow-float picker-sheet-safe fixed flex flex-col overflow-hidden rounded-t-lg border-x border-t"
        >
          <DialogPrimitive.Title className="sr-only">
            {label}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search and choose an option. Escape closes the picker.
          </DialogPrimitive.Description>

          <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <div className="min-w-0 flex-1">
              <SearchField
                ref={inputRef}
                hideLabel
                label={label}
                type="search"
                role="combobox"
                autoComplete="off"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={activeId}
                value={query}
                placeholder={placeholder}
                className="md:h-touch"
                onChange={(event) => onQuery(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton
                size="touch"
                label="Close picker"
                icon={
                  <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
                }
              />
            </DialogPrimitive.Close>
          </div>

          <PickerList
            items={items}
            selectedId={selectedId}
            activeIndex={active}
            rowHeight={PICKER_SHEET_ROW_HEIGHT}
            listboxId={listboxId}
            label={label}
            onSelect={onSelect}
            onActive={onActive}
            touchTargets
            loading={loading}
            {...(error ? { error } : {})}
            {...(emptyMessage ? { emptyMessage } : {})}
            {...(onRetry ? { onRetry } : {})}
            {...(clearOffset === 1 && onClear && clearable
              ? { clear: { label: clearLabel, onClear } }
              : {})}
            className="min-h-0 flex-1"
          />
        </DialogPrimitive.Content>
      </LayerPortal>
    </DialogPrimitive.Root>
  );
}
