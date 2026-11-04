import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export interface GlobalSearchProps {
  focusOnMount?: boolean;
  onSubmitted?: () => void;
  inputId?: string;
}

export function GlobalSearch({
  focusOnMount = false,
  onSubmitted,
  inputId = "vehicle-search",
}: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount]);

  return (
    <form
      aria-label="Vehicle search"
      className="relative flex min-w-0 flex-1 items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        void navigate({ to: "/map", search: q ? { q } : {} });
        onSubmitted?.();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search vehicles
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 size-4 text-subtle"
        strokeWidth={1.5}
      />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder="Search plate or IMEI"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-control-md w-full rounded-md border border-border-strong bg-surface pl-9 pr-9 text-sm text-text transition-colors duration-100 placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus-ring/30"
      />
      <kbd className="pointer-events-none absolute right-3 rounded-sm border border-border bg-surface-2 px-1 font-mono text-xs text-muted">
        /
      </kbd>
    </form>
  );
}
