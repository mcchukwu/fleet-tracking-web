import { useEffect, useState } from "react";

export function useDelayedFlag(active: boolean, delayMs = 200): boolean {
  const [visible, setVisible] = useState(false);

  if (!active && visible) setVisible(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return active && visible;
}
