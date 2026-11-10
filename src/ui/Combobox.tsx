import { ChevronDown, CircleAlert, Search } from "lucide-react";
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
const LIST_GAP = 4;
const VIEWPORT_MARGIN = 8;

interface ListBoxPosition {
  top: number | null;
  bottom: number | null;
  left: number;
  width: number;
  maxHeight: number;
}

function measureListBox(input: HTMLInputElement): ListBoxPosition {
  const rect = input.getBoundingClientRect();
  const dialogFooter = input
    .closest('[role="dialog"]')
    ?.querySelector<HTMLElement>("[data-dialog-footer]");
  const footerTop = dialogFooter?.getBoundingClientRect().top;
  const belowLimit =
    footerTop === undefined
      ? window.innerHeight - VIEWPORT_MARGIN
      : footerTop - VIEWPORT_MARGIN;
  const below = belowLimit - rect.bottom;
  const above = rect.top - VIEWPORT_MARGIN;
  const openAbove = below < 120 && above > below;
  const maxHeight = Math.max(
    80,
    Math.min(LIST_MAX_HEIGHT, openAbove ? above : below),
  );
  const width = Math.min(rect.width, window.innerWidth - VIEWPORT_MARGIN * 2);
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    window.innerWidth - VIEWPORT_MARGIN - width,
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
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const selected = items.find((item) => item.id === value) ?? null;
  const display = selected?.label ?? selectedLabel ?? "";
  const filtered = useMemo(
    () => items.filter((item) => matches(item, query)),
    [items, query],
  );
  const activeIndexClamped =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

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
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      closeList();
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
      <label htmlFor={inputId} className="text-text text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          strokeWidth={1.5}
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeItem ? `${listId}-${activeItem.id}` : undefined
          }
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
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
          className={cn(
            "h-touch border-border-strong bg-surface text-text placeholder:text-subtle focus-visible:border-accent focus-visible:ring-focus-ring/30 disabled:bg-surface-2 disabled:text-muted md:h-control-md w-full rounded-md border pr-9 pl-9 text-base transition-colors duration-100 focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed",
            error ? "border-danger" : undefined,
          )}
        />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "text-subtle pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 transition-transform duration-100",
            open ? "rotate-180" : undefined,
          )}
          strokeWidth={1.5}
        />
        {open && listBox ? (
          <LayerPortal layer="popover">
            <ul
              id={listId}
              role="listbox"
              aria-label={label}
              data-combobox-list
              style={listStyle(listBox)}
              className="border-border bg-surface shadow-menu overflow-y-auto rounded-md border p-1"
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
      </div>

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
