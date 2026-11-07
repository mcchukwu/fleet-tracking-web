import { ChevronDown, CircleAlert, Search } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "./cn";
/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role, jsx-a11y/click-events-have-key-events -- ARIA 1.2 combobox/listbox: the input owns the keyboard and aria-activedescendant; list options are pointer shortcuts. */

export interface ComboboxItem {
  id: string;
  label: string;
  /** Secondary line that also participates in the search, e.g. phone and licence. */
  description?: string;
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
  className?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, "");
}

function matches(item: ComboboxItem, query: string): boolean {
  const normalized = normalize(query);
  if (!normalized) return true;
  return normalize(`${item.label} ${item.description ?? ""}`).includes(normalized);
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
  className,
}: ComboboxProps) {
  const listId = useId();
  const inputId = useId();
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = items.find((item) => item.id === value) ?? null;
  const display = selected?.label ?? selectedLabel ?? "";
  const filtered = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);
  const activeIndexClamped = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  function openList(): void {
    if (disabled) return;
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
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeList();
      }}
    >
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
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
          onFocus={openList}
          onClick={() => {
            if (!open) openList();
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "h-touch w-full rounded-md border border-border-strong bg-surface pl-9 pr-9 text-base text-text transition-colors duration-100 placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus-ring/30 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted md:h-control-md",
            error ? "border-danger" : undefined,
          )}
        />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle transition-transform duration-100",
            open ? "rotate-180" : undefined,
          )}
          strokeWidth={1.5}
        />
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="z-menu max-h-64 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-menu"
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
                  "flex min-h-touch cursor-pointer flex-col justify-center rounded-sm px-3 py-1 text-sm md:min-h-control-md",
                  isActive ? "bg-surface-2" : undefined,
                  isSelected ? "text-accent-fg" : "text-text",
                )}
              >
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className="text-xs text-muted">{item.description}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
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
            <CircleAlert aria-hidden="true" className="size-3" strokeWidth={1.5} />
          ) : null}
          {statusMessage}
        </p>
      ) : null}

      {disabled && disabledReason ? (
        <p id={hintId} className="text-xs text-muted">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
