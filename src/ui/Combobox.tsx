import { ChevronDown, CircleAlert } from "lucide-react";
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
import { SearchField } from "./SearchField";
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

const LIST_MAX_HEIGHT = 256;
const LIST_COMFORTABLE = 160;
const LIST_MIN_WIDTH = 240;
const LIST_GAP = 4;
const VIEWPORT_MARGIN = 8;

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
  const belowLimit = Math.min(bounds.bottom, footerTop ?? Number.POSITIVE_INFINITY);
  const aboveLimit = Math.max(bounds.top, closeBottom ?? Number.NEGATIVE_INFINITY);
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
}: ComboboxProps) {
  const listId = useId();
  const inputId = useId();
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [listBox, setListBox] = useState<ListBoxPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const skipAutoOpen = useRef(initialFocus);

  useEffect(() => {
    if (initialFocus) inputRef.current?.focus();
  }, [initialFocus]);

  useEffect(() => {
    if (!open) return;
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
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(update);
    observer?.observe(input);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      document.removeEventListener("scroll", update, true);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const selected = items.find((item) => item.id === value) ?? null;
  const display = selected?.label ?? selectedLabel ?? "";
  const filtered = useMemo(
    () => items.filter((item) => matches(item, query)),
    [items, query],
  );
  const activeIndexClamped =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("[data-active]");
    if (!list || !active) return;
    const paddingTop =
      Number.parseFloat(window.getComputedStyle(list).paddingTop) || 0;
    const top = active.offsetTop - paddingTop;
    const bottom = top + active.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = Math.max(0, top);
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [open, activeIndexClamped, filtered.length]);

  function openList(): void {
    if (disabled) return;
    setListBox(null);
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }

  function closeList(): void {
    setOpen(false);
    setQuery("");
  }

  function select(item: ComboboxItem): void {
    onChange(item.id);
    closeList();
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openList();
      else setActiveIndex((index) => Math.min(filtered.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openList();
      else setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, filtered.length - 1));
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const item = filtered[activeIndexClamped];
      if (item) select(item);
      return;
    }
  }

  const statusMessage = loading
    ? "Loading options…"
    : error
      ? error
      : !loading && filtered.length === 0
        ? emptyMessage
        : null;
  const activeItem = open ? filtered[activeIndexClamped] : undefined;
  const statusId = `${inputId}-status`;
  const describedBy =
    [disabled && disabledReason ? hintId : null, error ? statusId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col gap-1", className)}
      onBlur={(event) => {
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
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeItem ? `${listId}-${activeItem.id}` : undefined
        }
        aria-describedby={describedBy}
        invalid={Boolean(error)}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        value={open ? query : display}
        placeholder={selected ? undefined : placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          if (skipAutoOpen.current) {
            skipAutoOpen.current = false;
            return;
          }
          openList();
        }}
        onClick={() => {
          if (!open) openList();
        }}
        onKeyDown={onKeyDown}
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
      {open && listBox ? (
        <LayerPortal layer="popover">
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            data-combobox-list
            style={listStyle(listBox)}
            className="border-border bg-surface shadow-menu overscroll-contain overflow-y-auto rounded-md border p-1"
          >
            {filtered.map((item, index) => {
              const isActive = index === activeIndexClamped;
              const isSelected = item.id === value;
              return (
                <li
                  key={item.id}
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isActive || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(item)}
                  className={cn(
                    "min-h-touch md:min-h-control-md flex cursor-pointer flex-col justify-center rounded-sm px-3 py-1 text-sm",
                    isActive ? "bg-surface-2" : undefined,
                    isSelected ? "text-accent-fg" : "text-text",
                  )}
                >
                  <span className={cn("font-medium", item.labelClassName)}>
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="text-muted text-xs">
                      {item.description}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </LayerPortal>
      ) : null}

      {statusMessage ? (
        <p
          id={statusId}
          role={error ? "alert" : open && !loading ? "status" : undefined}
          className={cn(
            "flex items-center gap-1 text-xs",
            error ? "text-danger" : "text-muted",
          )}
        >
          {error ? (
            <CircleAlert
              aria-hidden="true"
              className="size-3"
              strokeWidth={1.5}
            />
          ) : null}
          {statusMessage}
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
