import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface LiveRegionContextValue {
  announce: (message: string) => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);
export const LIVE_REGION_THROTTLE_MS = 5_000;

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const pending = useRef<string[]>([]);
  const lastAnnouncedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flush = useCallback(() => {
    timer.current = null;
    if (pending.current.length === 0) return;
    const text = pending.current.join(". ");
    pending.current = [];
    lastAnnouncedAt.current = Date.now();
    setMessage(text);
  }, []);

  const announce = useCallback(
    (next: string) => {
      const text = next.trim();
      if (!text) return;
      if (!pending.current.includes(text)) pending.current.push(text);
      if (timer.current) return;

      const wait = Math.max(0, LIVE_REGION_THROTTLE_MS - (Date.now() - lastAnnouncedAt.current));
      timer.current = setTimeout(flush, wait);
    },
    [flush],
  );

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </output>
    </LiveRegionContext.Provider>
  );
}

export function useLiveRegion(): LiveRegionContextValue {
  const value = useContext(LiveRegionContext);
  if (!value) throw new Error("useLiveRegion must be used inside LiveRegionProvider");
  return value;
}
