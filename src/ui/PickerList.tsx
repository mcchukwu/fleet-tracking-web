/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus, jsx-a11y/prefer-tag-over-role -- ARIA 1.2 listbox: the picker input owns focus and keyboard; options are pointer shortcuts. */
import { useVirtualizer } from "@tanstack/react-virtual";
import { CircleAlert } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";
import type { ComboboxItem } from "./Combobox";
import { cn } from "./cn";

export const PICKER_VIRTUALISE_ABOVE = 100;

export interface PickerListProps {
  items: readonly ComboboxItem[];
  selectedId: string | null;
  /** Index in the combined list: the clear row, when present, is index 0. */
  activeIndex: number;
  rowHeight: number;
  listboxId: string;
  label: string;
  onSelect: (item: ComboboxItem) => void;
  onActive: (index: number) => void;
  clear?: { label: string; onClear: () => void };
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  className?: string;
  style?: CSSProperties;
}

interface RowStyle {
  height: number;
}

interface VirtualRowStyle extends RowStyle {
  position: "absolute";
  top: number;
  left: number;
  width: string;
  transform: string;
}

function rowStyle(rowHeight: number): RowStyle {
  return { height: rowHeight };
}

function virtualRowStyle(rowHeight: number, start: number): VirtualRowStyle {
  return {
    height: rowHeight,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    transform: `translateY(${start}px)`,
  };
}

function StatusRow({
  children,
  error = false,
  role,
}: {
  children: ReactNode;
  error?: boolean;
  role?: "alert";
}) {
  return (
    <div
      role={role ?? "presentation"}
      className={cn(
        "flex items-center gap-1 px-3 py-4 text-sm",
        error ? "text-danger" : "text-muted",
      )}
    >
      {error ? (
        <CircleAlert aria-hidden="true" className="size-3" strokeWidth={1.5} />
      ) : null}
      {children}
    </div>
  );
}

/**
 * The one listbox body both picker presentations render. It owns the scroll
 * port, fixed row heights, the optional clear row and the loading, empty and
 * error states; above 100 options only a window of rows is mounted.
 */
export function PickerList({
  items,
  selectedId,
  activeIndex,
  rowHeight,
  listboxId,
  label,
  onSelect,
  onActive,
  clear,
  loading = false,
  error,
  emptyMessage = "No matches",
  onRetry,
  className,
  style,
}: PickerListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const clearOffset = clear ? 1 : 0;
  const total = items.length + clearOffset;
  const virtual = total > PICKER_VIRTUALISE_ABOVE;

  const virtualizer = useVirtualizer({
    count: virtual ? total : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  useEffect(() => {
    if (total === 0) return;
    if (virtual) {
      virtualizer.scrollToIndex(activeIndex, { align: "auto" });
      return;
    }
    const list = scrollRef.current;
    const active = list?.querySelector<HTMLElement>("[data-active]");
    if (!list || !active) return;
    const top = active.offsetTop;
    const bottom = top + active.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
    // oxlint-disable-next-line react/exhaustive-deps -- virtualizer is stable for the life of the list.
  }, [activeIndex, total, virtual]);

  const optionId = (id: string) => `${listboxId}-${id}`;

  function renderRow(
    index: number,
    rowCss: RowStyle | VirtualRowStyle,
  ): ReactNode {
    if (clear && index === 0) {
      const isActive = activeIndex === 0;
      const isSelected = selectedId === null;
      return (
        <div
          key="__clear__"
          id={optionId("clear")}
          role="option"
          aria-selected={isSelected}
          aria-posinset={1}
          aria-setsize={total}
          data-index={index}
          data-active={isActive || undefined}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActive(0)}
          onClick={() => {
            clear.onClear();
          }}
          style={rowCss}
          className={cn(
            "flex cursor-pointer items-center rounded-sm px-3 text-sm",
            isActive ? "bg-surface-2" : undefined,
            isSelected ? "text-accent-fg" : "text-text",
          )}
        >
          <span className="truncate">{clear.label}</span>
        </div>
      );
    }
    const item = items[index - clearOffset];
    if (!item) return null;
    const isActive = index === activeIndex;
    const isSelected = item.id === selectedId;
    return (
      <div
        key={item.id}
        id={optionId(item.id)}
        role="option"
        aria-selected={isSelected}
        aria-posinset={index + 1}
        aria-setsize={total}
        data-index={index}
        data-active={isActive || undefined}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => onActive(index)}
        onClick={() => onSelect(item)}
        style={rowCss}
        className={cn(
          "flex cursor-pointer flex-col justify-center rounded-sm px-3",
          isActive ? "bg-surface-2" : undefined,
          isSelected ? "text-accent-fg" : "text-text",
        )}
      >
        <span
          className={cn("truncate text-sm font-medium", item.labelClassName)}
        >
          {item.label}
        </span>
        {item.description ? (
          <span className="text-muted truncate text-xs">
            {item.description}
          </span>
        ) : null}
      </div>
    );
  }

  const status =
    loading && total === 0
      ? "loading"
      : items.length === 0 && !clear
        ? "empty"
        : "ready";

  if (status === "loading") {
    return (
      <div
        id={listboxId}
        role="listbox"
        aria-label={label}
        aria-busy="true"
        data-combobox-list
        className={cn(
          "border-border bg-surface overflow-y-auto overscroll-contain",
          className,
        )}
        style={style}
      >
        <StatusRow>Loading options…</StatusRow>
      </div>
    );
  }

  return (
    <div
      data-picker-list
      data-virtualized={virtual ? "true" : undefined}
      className={cn("flex min-h-0 flex-col", className)}
    >
      <div
        ref={scrollRef}
        id={listboxId}
        role="listbox"
        aria-label={label}
        data-combobox-list
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={style}
      >
        {status === "empty" ? (
          <StatusRow error={Boolean(error)} role={error ? "alert" : undefined}>
            {error ?? emptyMessage}
          </StatusRow>
        ) : null}

        {total > 0
          ? virtual
            ? [
                <div
                  key="virtual-space"
                  className="relative w-full"
                  style={rowStyle(total * rowHeight)}
                >
                  {virtualizer
                    .getVirtualItems()
                    .map((row) =>
                      renderRow(
                        row.index,
                        virtualRowStyle(rowHeight, row.start),
                      ),
                    )}
                </div>,
              ]
            : Array.from({ length: total }, (_, index) =>
                renderRow(index, rowStyle(rowHeight)),
              )
          : null}

        {status === "ready" && items.length === 0 && clear ? (
          <StatusRow>{emptyMessage}</StatusRow>
        ) : null}
      </div>

      {error && total > 0 ? (
        <div
          role="alert"
          className="border-border text-danger flex items-center justify-between gap-2 border-t px-3 py-2 text-xs"
        >
          <span className="truncate">{error}</span>
          {onRetry ? (
            <Button
              size="sm"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onRetry}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {error && status === "empty" && onRetry ? (
        <div className="border-border border-t px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
