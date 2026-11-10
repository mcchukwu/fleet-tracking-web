import { useState } from "react";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button } from "../ui/Button";
import { Combobox, type ComboboxItem } from "../ui/Combobox";
import { Dialog } from "../ui/Dialog";
import { SearchField } from "../ui/SearchField";

const COUNTS = [3, 25, 500] as const;
type Count = (typeof COUNTS)[number];

const PLATES = ["LSD-100-AA", "KJA-441-BB", "ABJ-902-CC"];

function options(count: Count): ComboboxItem[] {
  if (count === 3) {
    return PLATES.map((plate, index) => ({
      id: plate,
      label: plate,
      description: `86100000000000${index + 1} · Depot ${index + 1}`,
      labelClassName: "font-mono",
    }));
  }
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return {
      id: `vehicle-${number}`,
      label: `LSD-${number}-AA`,
      description: `8610000000${number} · Depot ${(index % 7) + 1}`,
      labelClassName: "font-mono",
    };
  });
}

/**
 * Dev-only fixture for the combobox layout contract: the same picker with 3,
 * 25 and 500 options, standalone and inside a dialog. Measurement and e2e
 * layout specs open these so option count is deterministic.
 */
export function ComboboxLab() {
  useDocumentTitle("Combobox lab");
  const [standalone, setStandalone] = useState<Record<Count, string | null>>({
    3: null,
    25: null,
    500: null,
  });
  const [dialog, setDialog] = useState<Count | null>(null);
  const [dialogValue, setDialogValue] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  return (
    <div className="max-w-content text-text mx-auto flex w-full flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-lg font-semibold">Combobox lab</h1>
      <p className="text-muted max-w-prose text-sm">
        The same picker with 3, 25 and 500 options, standalone and inside a
        dialog. The measurement script and the layout specs read these.
      </p>

      <section
        aria-label="Search field"
        data-testid="lab-search"
        className="flex w-80 max-w-full flex-col gap-3"
      >
        <SearchField
          label="Vehicle search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Plate or IMEI"
          trailing={
            <kbd className="border-border bg-surface-2 text-muted rounded-sm border px-1 font-mono text-xs">
              /
            </kbd>
          }
        />
      </section>

      {COUNTS.map((count) => (
        <section
          key={count}
          aria-label={`${count} options`}
          data-combobox-count={count}
          className="flex w-80 max-w-full flex-col gap-3"
        >
          <Combobox
            label={`Vehicle (${count} options)`}
            items={options(count)}
            value={standalone[count]}
            onChange={(id) =>
              setStandalone((current) => ({ ...current, [count]: id }))
            }
            placeholder="Search by plate or IMEI"
          />
          <Button size="sm" onClick={() => setDialog(count)}>
            Open {count}-option dialog
          </Button>
        </section>
      ))}

      <Dialog
        open={dialog !== null}
        onOpenChange={(next) => {
          if (!next) setDialog(null);
        }}
        title="Change vehicle"
        description="Search by plate or IMEI."
        footer={
          <Button size="sm" variant="ghost" onClick={() => setDialog(null)}>
            Cancel
          </Button>
        }
      >
        {dialog !== null ? (
          <Combobox
            label="Vehicle"
            items={options(dialog)}
            value={dialogValue}
            onChange={setDialogValue}
            placeholder="Search by plate or IMEI"
          />
        ) : null}
      </Dialog>
    </div>
  );
}
