import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { VehiclePicker } from "./VehiclePicker";

export interface ChangeVehicleDialogProps {
  open: boolean;
  value: string | null;
  onChange: (id: string) => void;
  onClose: () => void;
}

export function ChangeVehicleDialog({
  open,
  value,
  onChange,
  onClose,
}: ChangeVehicleDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Change vehicle"
      description="Search by plate or IMEI."
      footer={
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <VehiclePicker
        value={value}
        initialFocus
        overlay
        onChange={(id) => {
          onChange(id);
          onClose();
        }}
      />
    </Dialog>
  );
}
