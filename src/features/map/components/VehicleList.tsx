import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { VehicleRow } from "./VehicleRow";
import type { VehicleRow as VehicleRowData } from "../lib/filter";

export function listHeightStyle(height: number) {
  return { height };
}

export function virtualRowStyle(start: number, height: number) {
  return {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height,
    transform: `translateY(${start}px)`,
  };
}

export interface VehicleListProps {
  rows: readonly VehicleRowData[];
  selectedKey: string | null;
  rowHeight: number;
  signature: string;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}

export function VehicleList({
  rows,
  selectedKey,
  rowHeight,
  signature,
  onSelect,
  onHover,
}: VehicleListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  // oxlint-disable-next-line react/incompatible-library -- TanStack Virtual owns measurement and scroll position.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 6,
  });

  useEffect(() => {
    if (parentRef.current) parentRef.current.scrollTop = 0;
  }, [signature]);

  useEffect(() => {
    if (!selectedKey) {
      scrolledFor.current = null;
      return;
    }
    // Rows are rebuilt on every live tick; scrolling on the array would drag the
    // reader back to the selection once a second. Scroll only when it changes.
    if (scrolledFor.current === selectedKey) return;
    const index = rows.findIndex((row) => row.key === selectedKey);
    if (index < 0) return;
    scrolledFor.current = selectedKey;
    virtualizer.scrollToIndex(index, { align: "auto" });
  }, [rows, selectedKey, virtualizer]);

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      <ul
        aria-label="Vehicles"
        className="relative w-full"
        style={listHeightStyle(virtualizer.getTotalSize())}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          return (
            <li key={row.key} style={virtualRowStyle(virtualRow.start, rowHeight)}>
              <VehicleRow
                row={row}
                height={rowHeight}
                selected={row.key === selectedKey}
                onSelect={onSelect}
                onHover={onHover}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
