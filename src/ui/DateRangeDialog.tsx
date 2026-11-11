import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Input } from "./Input";
import {
  fromLocalInputValue,
  toLocalInputValue,
  type DatetimeField,
  type DatetimeRangeValidation,
} from "../lib/datetime";

export interface DateRangeDialogProps {
  open: boolean;
  from: string;
  to: string;
  title?: string;
  description?: string;
  validate: (fromIso: string, toIso: string) => DatetimeRangeValidation;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}

const emptyMessage = "Choose a start and end time.";

function fieldOf(
  validation: DatetimeRangeValidation,
  startIso: string | null,
  endIso: string | null,
): DatetimeField {
  if (!validation.valid && validation.field) return validation.field;
  if (!startIso && !endIso) return "both";
  return startIso ? "end" : "start";
}

export function DateRangeDialog({
  open,
  from,
  to,
  title = "Custom range",
  description = "Times are local; the request uses UTC.",
  validate,
  onApply,
  onClose,
}: DateRangeDialogProps) {
  const [start, setStart] = useState(() => toLocalInputValue(from));
  const [end, setEnd] = useState(() => toLocalInputValue(to));
  const [error, setError] = useState<{
    message: string;
    field: DatetimeField;
  } | null>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // oxlint-disable-next-line react/set-state-in-effect -- opening the dialog seeds the fields from the current range.
    setStart(toLocalInputValue(from));
    setEnd(toLocalInputValue(to));
    setError(null);
  }, [open, from, to]);

  function apply(): void {
    const startIso = fromLocalInputValue(start);
    const endIso = fromLocalInputValue(end);
    if (!startIso || !endIso) {
      const field = fieldOf(
        { valid: false, reason: "missing", message: emptyMessage },
        startIso,
        endIso,
      );
      setError({ message: emptyMessage, field });
      (field === "end" ? endRef : startRef).current?.focus();
      return;
    }

    const validation = validate(startIso, endIso);
    if (!validation.valid) {
      const field = fieldOf(validation, startIso, endIso);
      setError({ message: validation.message, field });
      (field === "end" ? endRef : startRef).current?.focus();
      return;
    }

    onApply(startIso, endIso);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={apply}>
            Apply
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          ref={startRef}
          label="Start"
          type="datetime-local"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          error={error && error.field !== "end" ? error.message : undefined}
        />
        <Input
          ref={endRef}
          label="End"
          type="datetime-local"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          error={error && error.field !== "start" ? error.message : undefined}
        />
      </div>
    </Dialog>
  );
}
