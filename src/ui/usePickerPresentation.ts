import { useEffect, useState } from "react";

export type PickerPresentation = "popover" | "sheet";

export const PICKER_MEDIA_QUERY = "(min-width: 768px) and (pointer: fine)";

export function pickerPresentation(matches: boolean): PickerPresentation {
  return matches ? "popover" : "sheet";
}

function supportsMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * One media query chooses the picker presentation: an anchored popover on a
 * wide fine-pointer viewport, a modal sheet otherwise. The fallback is the
 * popover when the browser cannot answer the query.
 */
export function usePickerPresentation(): PickerPresentation {
  const [matches, setMatches] = useState(() =>
    supportsMatchMedia() ? window.matchMedia(PICKER_MEDIA_QUERY).matches : true,
  );

  useEffect(() => {
    if (!supportsMatchMedia()) return;
    const query = window.matchMedia(PICKER_MEDIA_QUERY);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return pickerPresentation(matches);
}
