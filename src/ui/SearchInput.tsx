import { Search, X } from "lucide-react";
import { Input } from "./Input";
import { IconButton } from "./IconButton";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function SearchInput({ value, onChange, label = "Search vehicles", placeholder = "Plate or IMEI" }: SearchInputProps) {
  return (
    <Input
      type="search"
      name="vehicle-search"
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      leadingIcon={<Search className="size-4" strokeWidth={1.5} />}
      trailing={
        <>
          {value ? (
            <IconButton
              label="Clear search"
              size="sm"
              icon={<X aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
              onClick={() => onChange("")}
            />
          ) : (
            <kbd className="rounded-sm border border-border bg-surface-2 px-1 font-mono text-xs text-muted">/</kbd>
          )}
        </>
      }
    />
  );
}
