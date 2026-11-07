import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { SHEET_PEEK } from "../lib/constants";
import {
  clampVisible,
  isObscured,
  nearestSnap,
  SHEET_STRIP,
  sheetMetricsFromAvailable,
  sheetVisible,
  TOP_BAR_HEIGHT,
  type SheetMetrics,
  type SheetSnap,
} from "../lib/sheet";

function readToken(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const value = Number.parseFloat(
    window.getComputedStyle(document.documentElement).getPropertyValue(name),
  );
  return Number.isFinite(value) ? value : fallback;
}

export interface UseSheetDragOptions {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  insetTarget?: RefObject<HTMLElement | null>;
  onObscuredChange?: (obscured: boolean) => void;
}

export interface SheetDragHandlers {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
}

export interface SheetDrag {
  sheetRef: RefObject<HTMLElement | null>;
  metrics: SheetMetrics;
  visible: number;
  handlers: SheetDragHandlers;
}

/**
 * Drag, snap, publish and obscured mechanics shared by the vehicle list sheet
 * and the vehicle detail sheet. Publishing is per animation frame.
 */
export function useSheetDrag({
  snap,
  onSnap,
  insetTarget,
  onObscuredChange,
}: UseSheetDragOptions): SheetDrag {
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );
  // Measure against the map surface, not the window: banners and the top bar
  // live outside this page and shrink it.
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const availableHeight =
    containerHeight ??
    Math.max(0, viewportHeight - readToken("--spacing-topbar", TOP_BAR_HEIGHT));
  const metrics = useMemo(
    () =>
      sheetMetricsFromAvailable(
        availableHeight,
        readToken("--spacing-sheet-strip", SHEET_STRIP),
        readToken("--spacing-sheet-peek", SHEET_PEEK),
      ),
    [availableHeight],
  );
  const visible = sheetVisible(snap, metrics);

  const sheetRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startY: number; startVisible: number } | null>(null);
  const pendingRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const obscuredRef = useRef(false);
  const onObscuredChangeRef = useRef(onObscuredChange);

  useEffect(() => {
    onObscuredChangeRef.current = onObscuredChange;
  }, [onObscuredChange]);

  useEffect(
    () => () => {
      if (!obscuredRef.current) return;
      obscuredRef.current = false;
      onObscuredChangeRef.current?.(false);
    },
    [],
  );

  function publish(candidate: number): number {
    const next = clampVisible(candidate, metrics);
    sheetRef.current?.style.setProperty("--sheet-visible", `${next}px`);
    insetTarget?.current?.style.setProperty("--map-inset-bottom", `${next}px`);
    const obscured = isObscured(next, metrics);
    if (obscured !== obscuredRef.current) {
      obscuredRef.current = obscured;
      onObscuredChange?.(obscured);
    }
    return next;
  }

  function flush(): void {
    if (pendingRef.current === null) return;
    publish(pendingRef.current);
  }

  function schedule(): void {
    if (typeof requestAnimationFrame !== "function") {
      flush();
      return;
    }
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      flush();
    });
  }

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const target = insetTarget?.current;
    return () => {
      if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      target?.removeAttribute("data-sheet-dragging");
    };
  }, [insetTarget]);

  useEffect(() => {
    const container = sheetRef.current?.parentElement;
    if (!container || typeof ResizeObserver === "undefined") return;
    const update = () => setContainerHeight(container.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const next = clampVisible(visible, metrics);
    sheetRef.current?.style.setProperty("--sheet-visible", `${next}px`);
    insetTarget?.current?.style.setProperty("--map-inset-bottom", `${next}px`);
    const obscured = isObscured(next, metrics);
    if (obscured !== obscuredRef.current) {
      obscuredRef.current = obscured;
      onObscuredChange?.(obscured);
    }
  }, [visible, metrics, insetTarget, onObscuredChange]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement;
    // Portals (menus, tooltips) bubble through the React tree, not the DOM tree.
    if (!event.currentTarget.contains(target)) return;
    if (target.closest("[data-sheet-action]")) return;
    dragRef.current = { startY: event.clientY, startVisible: visible };
    // Keep keyboard focus where it is; a pointer drag must not blur it first.
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    insetTarget?.current?.setAttribute("data-sheet-dragging", "true");
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!dragRef.current) return;
    pendingRef.current =
      dragRef.current.startVisible + (dragRef.current.startY - event.clientY);
    schedule();
  }

  function endDrag(snapToNearest: boolean): void {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const target = snapToNearest
      ? nearestSnap(pendingRef.current ?? visible, metrics)
      : snap;
    pendingRef.current = null;
    // Resolve the snap before publishing: when the nearest snap is the snap the
    // sheet already reports, React does not re-render, so this imperative write
    // is what returns the sheet to its resting height.
    publish(sheetVisible(target, metrics));
    insetTarget?.current?.removeAttribute("data-sheet-dragging");
    if (snapToNearest) onSnap(target);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current) {
      pendingRef.current =
        dragRef.current.startVisible + (dragRef.current.startY - event.clientY);
    }
    endDrag(true);
  }

  function onPointerCancel(): void {
    if (dragRef.current) pendingRef.current = visible;
    endDrag(false);
  }

  return {
    sheetRef,
    metrics,
    visible,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
