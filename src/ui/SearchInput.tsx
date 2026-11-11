import { useState } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { SearchField } from "./SearchField";
import { useDebouncedCallback } from "../lib/useDebouncedCallback";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** The map sheet header uses a visually hidden label and no shortcut hint. */
  compact?: boolean;
  /** Keeps the field's name meaningful on screens other than the map. */
  name?: string;
}

export function SearchInput({
  value,
  onChange,
  label = "Search vehicles",
  placeholder = "Plate or IMEI",
  compact = false,
  name = "vehicle-search",
}: SearchInputProps) {
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

  const hasTrailing = draft.length > 0 || !compact;

  return (
    <SearchField
      type="search"
      name={name}
      label={label}
      hideLabel={compact}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => update(event.target.value)}
      trailing={
        hasTrailing ? (
          <>
            {draft ? (
              <IconButton
                label="Clear search"
                size="sm"
                icon={
                  <X
                    aria-hidden="true"
                    className="size-icon-sm"
                    strokeWidth={1.5}
                  />
                }
                onClick={() => update("")}
              />
            ) : (
              <kbd className="border-border bg-surface-2 text-muted rounded-sm border px-1 font-mono text-xs">
                /
              </kbd>
            )}
          </>
        ) : undefined
      }
    />
  );
}
