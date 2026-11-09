import { useEffect, useRef, useState } from "react";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import {
  fromLocalInputValue,
  toLocalInputValue,
  validateRange,
} from "../lib/range";

export interface CustomRangeDialogProps {
  open: boolean;
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}

export function CustomRangeDialog({
  open,
  from,
  to,
  onApply,
  onClose,
}: CustomRangeDialogProps) {
  const [start, setStart] = useState(() => toLocalInputValue(from));
  const [end, setEnd] = useState(() => toLocalInputValue(to));
  const [error, setError] = useState<{
    message: string;
    fields: "start" | "end" | "both";
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
      setError({
        message: "Choose a start and end time.",
        fields: !startIso && !endIso ? "both" : startIso ? "end" : "start",
      });
      (startIso ? endRef : startRef).current?.focus();
      return;
    }
    const validation = validateRange(startIso, endIso);
    if (!validation.valid) {
      const crossField = validation.reason === "order" || validation.reason === "too_long";
      setError({ message: validation.message, fields: crossField ? "both" : "start" });
      (crossField ? startRef : endRef).current?.focus();
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
      title="Custom range"
      description="Times are local; the request uses UTC."
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
          error={error && error.fields !== "end" ? error.message : undefined}
        />
        <Input
          ref={endRef}
          label="End"
          type="datetime-local"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          error={error && error.fields !== "start" ? error.message : undefined}
        />
      </div>
    </Dialog>
  );
}
