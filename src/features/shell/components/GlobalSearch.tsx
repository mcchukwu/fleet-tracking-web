import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { IconButton } from "../../../ui/IconButton";

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
        className="text-subtle pointer-events-none absolute left-3 size-4"
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
        onKeyDown={(event) => {
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            setValue("");
          }
        }}
        className="h-touch border-border-strong bg-surface text-text placeholder:text-subtle focus-visible:border-accent focus-visible:ring-focus-ring/30 md:h-control-md w-full rounded-md border pr-12 pl-8 text-sm transition-colors duration-100 focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset md:pr-8"
      />
      {value ? (
        <IconButton
          className="absolute right-0"
          label="Clear search"
          size="sm"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          icon={<X aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
        />
      ) : (
        <kbd className="border-border bg-surface-2 text-muted pointer-events-none absolute right-3 rounded-sm border px-1 font-mono text-xs">
          /
        </kbd>
      )}
    </form>
  );
}
