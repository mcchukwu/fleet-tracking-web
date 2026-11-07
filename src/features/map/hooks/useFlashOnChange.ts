import { useState } from "react";

/**
 * Returns a key that changes whenever `value` changes. Mounting on that key
 * restarts the 600ms flash animation, so no timer can leak.
 */
export function useFlashOnChange(value: unknown): number {
  const [tracked, setTracked] = useState({ value, key: 0 });
  if (!Object.is(tracked.value, value)) {
    setTracked({ value, key: tracked.key + 1 });
  }
  return tracked.key;
}
