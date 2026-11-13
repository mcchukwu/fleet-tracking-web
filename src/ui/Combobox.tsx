import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { cn } from "./cn";
import { LayerPortal } from "./LayerPortal";
import { PickerList } from "./PickerList";
import { PickerSheet } from "./PickerSheet";
import { SearchField } from "./SearchField";
import { usePickerPresentation } from "./usePickerPresentation";
/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role, jsx-a11y/click-events-have-key-events -- ARIA 1.2 combobox/listbox: the input owns the keyboard and aria-activedescendant; list options are pointer shortcuts. */

export interface ComboboxItem {
  id: string;
  label: string;
  /** Secondary line that also participates in the search, e.g. phone and licence. */
  description?: string;
  /** Optional class for the primary line, e.g. mono for a plate. */
  labelClassName?: string;
}

export interface ComboboxProps {
  label: string;
  items: readonly ComboboxItem[];
  value: string | null;
  selectedLabel?: string;
  onChange: (id: string) => void;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  initialFocus?: boolean;
  className?: string;
  /** Retry for the query that feeds the picker; shown with cached options too. */
  onRetry?: () => void;
  /** Only optional fields offer a Clear row; required fields never do. */
  clearable?: boolean;
  onClear?: () => void;
  clearLabel?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, "");
}

function matches(item: ComboboxItem, query: string): boolean {
  const normalized = normalize(query);
  if (!normalized) return true;
  return normalize(`${item.label} ${item.description ?? ""}`).includes(
    normalized,
  );
}

const LIST_MAX_HEIGHT = 360;
const LIST_COMFORTABLE = 160;
const LIST_MIN_WIDTH = 240;
const LIST_GAP = 4;
const VIEWPORT_MARGIN = 8;
const POPOVER_ROW_HEIGHT = 44;

interface ListBoxPosition {
  top: number | null;
  bottom: number | null;
  left: number;
  width: number;
  maxHeight: number;
}

interface VisibleBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The area the user can actually see. With the software keyboard open the
 * visual viewport is shorter than the layout viewport, and position: fixed is
 * still measured against the layout viewport, so both are needed.
 */
function visibleBounds(): VisibleBounds {
  const viewport = window.visualViewport;
  const offsetTop = viewport?.offsetTop ?? 0;
  const offsetLeft = viewport?.offsetLeft ?? 0;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  return {
    top: offsetTop + VIEWPORT_MARGIN,
    bottom: offsetTop + height - VIEWPORT_MARGIN,
    left: offsetLeft + VIEWPORT_MARGIN,
    right: offsetLeft + width - VIEWPORT_MARGIN,
  };
}

function measureListBox(input: HTMLInputElement): ListBoxPosition {
  const rect = input.getBoundingClientRect();
  const bounds = visibleBounds();
  const dialog = input.closest('[role="dialog"]');
  const footerTop =
    dialog
      ?.querySelector<HTMLElement>("[data-dialog-footer]")
      ?.getBoundingClientRect().top ?? null;
  const closeBottom =
    dialog
      ?.querySelector<HTMLElement>('[aria-label="Close dialog"]')
      ?.getBoundingClientRect().bottom ?? null;

  // The list may overlay the dialog's content, never its close or footer
  // controls. Geometry, not z-index, keeps those reachable.
  const belowLimit = Math.min(
    bounds.bottom,
    footerTop ?? Number.POSITIVE_INFINITY,
  );
  const aboveLimit = Math.max(
    bounds.top,
    closeBottom ?? Number.NEGATIVE_INFINITY,
  );
  const below = belowLimit - LIST_GAP - rect.bottom;
  const above = rect.top - LIST_GAP - aboveLimit;
  const openAbove = below < LIST_COMFORTABLE && above > below;
  const maxHeight = Math.max(
    0,
    Math.min(LIST_MAX_HEIGHT, openAbove ? above : below),
  );

  const width = Math.min(
    Math.max(rect.width, LIST_MIN_WIDTH),
    bounds.right - bounds.left,
  );
  const left = Math.min(
    Math.max(bounds.left, rect.left),
    Math.max(bounds.left, bounds.right - width),
  );

  return openAbove
    ? {
        top: null,
        bottom: window.innerHeight - rect.top + LIST_GAP,
        left,
        width,
        maxHeight,
      }
    : {
        top: rect.bottom + LIST_GAP,
        bottom: null,
        left,
        width,
        maxHeight,
      };
}

function listStyle(box: ListBoxPosition): CSSProperties {
  return {
    position: "fixed",
    pointerEvents: "auto",
    top: box.top ?? "auto",
    bottom: box.bottom ?? "auto",
    left: box.left,
    width: box.width,
    maxHeight: box.maxHeight,
  };
}

export function Combobox({
  label,
  items,
  value,
  selectedLabel,
  onChange,
  loading = false,
  error,
  emptyMessage = "No matches",
  disabled = false,
  disabledReason,
  placeholder = "Search",
  initialFocus = false,
  className,
  onRetry,
  clearable = false,
  onClear,
  clearLabel = "Clear selection",
}: ComboboxProps) {
  const listId = useId();
  const sheetId = useId();
  const hintId = useId();
  const presentation = usePickerPresentation();
  const sheet = presentation === "sheet";
  const [open, setOpen] = useState(false);
  const [openPresentation, setOpenPresentation] = useState(presentation);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [listBox, setListBox] = useState<ListBoxPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipAutoOpen = useRef(initialFocus);

  // A viewport change while open closes the picker, so the sheet and the
  // popover can never coexist. Adjusting state during render is React's
  // documented way to reset state when a prop (here: the presentation) changes.
  if (open && openPresentation !== presentation) {
    setOpen(false);
    setOpenPresentation(presentation);
    setQuery("");
    setActiveIndex(0);
  }

  useEffect(() => {
    if (initialFocus) inputRef.current?.focus();
  }, [initialFocus]);

  useEffect(() => {
    if (!open || sheet) return;
    const input = inputRef.current;
    if (!input) return;
    const update = () => setListBox(measureListBox(input));
    update();
    const viewport = window.visualViewport;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    document.addEventListener("scroll", update, true);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(input);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      document.removeEventListener("scroll", update, true);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [open, sheet]);

  useEffect(() => {
    if (!open || sheet) return;
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Radix closes the dialog from a capture listener on the document. While
      // the list is open the combobox owns Escape, so the first press closes
      // only the list and focus stays in the input.
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      setQuery("");
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [open, sheet]);

  const selected = items.find((item) => item.id === value) ?? null;
  const display = selected?.label ?? selectedLabel ?? "";
  const filtered = useMemo(
    () => items.filter((item) => matches(item, query)),
    [items, query],
  );
  const clearOffset = clearable && onClear ? 1 : 0;
  const total = filtered.length + clearOffset;
  const activeIndexClamped = total === 0 ? 0 : Math.min(activeIndex, total - 1);
  const activeItem =
    clearOffset === 1 && activeIndexClamped === 0
      ? null
      : filtered[activeIndexClamped - clearOffset];
  const activeOptionId =
    total === 0
      ? undefined
      : clearOffset === 1 && activeIndexClamped === 0
        ? `${listId}-clear`
        : activeItem
          ? `${listId}-${activeItem.id}`
          : undefined;

  function focusTrigger(): void {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function openList(): void {
    if (disabled) return;
    setListBox(null);
    setOpenPresentation(presentation);
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }

  function closeList(): void {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function closeSheet(): void {
    closeList();
    focusTrigger();
  }

  function select(item: ComboboxItem): void {
    onChange(item.id);
    closeList();
    focusTrigger();
  }

  function selectClear(): void {
    onClear?.();
    closeList();
    focusTrigger();
  }

  function moveActive(delta: 1 | -1): void {
    setActiveIndex((index) => {
      if (total === 0) return 0;
      const current = Math.min(index, total - 1);
      return Math.max(0, Math.min(total - 1, current + delta));
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openList();
      else moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openList();
      else moveActive(-1);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, total - 1));
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (clearOffset === 1 && activeIndexClamped === 0) {
        selectClear();
        return;
      }
      if (activeItem) select(activeItem);
    }
  }

  function onSheetTriggerKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      openList();
    }
  }

  const triggerValue = sheet ? display : open ? query : display;
  const statusId = `${hintId}-status`;
  // Validation errors belong under the field; a query error moves into the
  // open picker, where its Retry lives.
  const showTriggerError = Boolean(error) && !open;
  const describedBy =
    [
      disabled && disabledReason ? hintId : null,
      showTriggerError ? statusId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col gap-1", className)}
      onBlur={(event) => {
        if (sheet) return;
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          closeList();
      }}
    >
      <SearchField
        ref={inputRef}
        label={label}
        type="text"
        role="combobox"
        autoComplete="off"
        readOnly={sheet}
        aria-expanded={open}
        aria-haspopup={sheet ? "dialog" : "listbox"}
        aria-controls={open ? (sheet ? sheetId : listId) : undefined}
        aria-autocomplete={sheet ? undefined : "list"}
        aria-activedescendant={!sheet && open ? activeOptionId : undefined}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        value={triggerValue}
        placeholder={selected || display ? undefined : placeholder}
        onChange={(event) => {
          if (sheet) return;
          setQuery(event.target.value);
          if (!open) setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          if (sheet) return;
          if (skipAutoOpen.current) {
            skipAutoOpen.current = false;
            return;
          }
          openList();
        }}
        onClick={() => {
          if (!open) openList();
        }}
        onKeyDown={sheet ? onSheetTriggerKeyDown : onKeyDown}
        trailing={
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "text-subtle pointer-events-none size-4 transition-transform duration-100",
              open ? "rotate-180" : undefined,
            )}
            strokeWidth={1.5}
          />
        }
      />

      {open && listBox && !sheet ? (
        <LayerPortal layer="popover">
          <div
            data-combobox-shell
            style={listStyle(listBox)}
            className="border-border bg-surface shadow-menu flex flex-col overflow-hidden rounded-md border"
          >
            <PickerList
              items={filtered}
              selectedId={value}
              activeIndex={activeIndexClamped}
              rowHeight={POPOVER_ROW_HEIGHT}
              listboxId={listId}
              label={label}
              onSelect={select}
              onActive={setActiveIndex}
              loading={loading}
              {...(error ? { error } : {})}
              {...(emptyMessage ? { emptyMessage } : {})}
              {...(onRetry ? { onRetry } : {})}
              {...(clearOffset === 1
                ? { clear: { label: clearLabel, onClear: selectClear } }
                : {})}
              className="max-h-full min-h-0"
            />
          </div>
        </LayerPortal>
      ) : null}

      <PickerSheet
        id={sheetId}
        open={open && sheet}
        label={label}
        placeholder={placeholder}
        query={query}
        onQuery={(next) => {
          setQuery(next);
          setActiveIndex(0);
        }}
        items={filtered}
        selectedId={value}
        activeIndex={activeIndexClamped}
        onActive={setActiveIndex}
        onSelect={select}
        onClose={closeSheet}
        clearable={clearable}
        {...(onClear ? { onClear: selectClear } : {})}
        clearLabel={clearLabel}
        loading={loading}
        {...(error ? { error } : {})}
        {...(emptyMessage ? { emptyMessage } : {})}
        {...(onRetry ? { onRetry } : {})}
      />

      {showTriggerError ? (
        <p
          id={statusId}
          role="alert"
          className="text-danger flex items-center gap-1 text-xs"
        >
          {error}
        </p>
      ) : null}

      {disabled && disabledReason ? (
        <p id={hintId} className="text-muted text-xs">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
