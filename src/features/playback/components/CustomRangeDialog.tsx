import { DateRangeDialog } from "../../../ui/DateRangeDialog";
import { validateRange } from "../lib/range";

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
  return (
    <DateRangeDialog
      open={open}
      from={from}
      to={to}
      validate={validateRange}
      onApply={onApply}
      onClose={onClose}
    />
  );
}
