import { FileUp, X } from "lucide-react";
import { useRef, useState, type DragEvent, type Ref } from "react";
import { formatBytes } from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { cn } from "../../../ui/cn";

export interface ImportFilePickerProps {
  file: File | null;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: (file: File) => void;
  onClear: () => void;
  chooseButtonRef?: Ref<HTMLButtonElement>;
}

export function ImportFilePicker({
  file,
  disabled = false,
  disabledReason,
  onSelect,
  onClear,
  chooseButtonRef,
}: ImportFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function choose(): void {
    if (disabled) return;
    inputRef.current?.click();
  }

  function accept(next: File | undefined): void {
    if (!next || disabled) return;
    onSelect(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files[0]);
  }

  return (
    <section
      aria-labelledby="import-file-title"
      data-testid="import-file-picker"
      className="flex flex-col gap-3"
    >
      <h2 id="import-file-title" className="text-text text-sm font-medium">
        Vehicle file
      </h2>

      <div
        data-testid="import-drop-zone"
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "border-border-strong bg-surface flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 transition-colors duration-100 motion-reduce:transition-none",
          dragging && "border-accent bg-accent-soft",
        )}
      >
        <div className="flex items-center gap-2">
          <FileUp
            aria-hidden="true"
            className="text-subtle size-5 shrink-0"
            strokeWidth={1.5}
          />
          <p className="text-text text-sm">
            Drop a .csv here, or choose a file.
          </p>
        </div>
        <Button
          ref={chooseButtonRef}
          variant={file ? "secondary" : "primary"}
          onClick={choose}
          {...(disabled
            ? { disabledReason: disabledReason ?? "Uploading." }
            : {})}
        >
          {file ? "Choose another file" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          data-testid="import-file-input"
          type="file"
          accept=".csv,text/csv"
          tabIndex={-1}
          className="sr-only"
          onChange={(event) => {
            accept(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      {file ? (
        <div
          data-testid="import-selected-file"
          className="border-border bg-surface-2 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-text truncate text-sm" title={file.name}>
              {file.name}
            </span>
            <span className="text-muted text-xs tabular-nums">
              {formatBytes(file.size)}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Remove selected file"
            leadingIcon={
              <X aria-hidden="true" className="size-3" strokeWidth={1.5} />
            }
            onClick={onClear}
            {...(disabled
              ? { disabledReason: disabledReason ?? "Uploading." }
              : {})}
          >
            Remove
          </Button>
        </div>
      ) : null}
    </section>
  );
}
