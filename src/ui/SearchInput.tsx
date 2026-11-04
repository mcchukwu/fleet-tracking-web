import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./Input";
import { IconButton } from "./IconButton";
import { useDebouncedCallback } from "../lib/useDebouncedCallback";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function SearchInput({ value, onChange, label = "Search vehicles", placeholder = "Plate or IMEI" }: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const emit = useDebouncedCallback(onChange, 150);

  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  function update(next: string): void {
    setDraft(next);
    emit(next);
  }

  return (
    <Input
      type="search"
      name="vehicle-search"
      label={label}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => update(event.target.value)}
      leadingIcon={<Search className="size-4" strokeWidth={1.5} />}
      trailing={
        <>
          {draft ? (
            <IconButton
              label="Clear search"
              size="sm"
              icon={<X aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
              onClick={() => update("")}
            />
          ) : (
            <kbd className="rounded-sm border border-border bg-surface-2 px-1 font-mono text-xs text-muted">/</kbd>
          )}
        </>
      }
    />
  );
}
