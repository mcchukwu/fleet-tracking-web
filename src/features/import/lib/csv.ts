import Papa from "papaparse";
import type { ImportResult } from "../../../api/types";
import { IMPORT_HEADERS } from "./constants";

type ImportError = NonNullable<ImportResult["errors"]>[number];

export function importHeaderRow(): string {
  return IMPORT_HEADERS.join(",");
}

export function sampleCsv(): string {
  const rows = [
    {
      imei: "example-imei-0001",
      plate: "LSD-100-AA",
      vehicle_type: "truck",
      make: "Volvo",
      model: "FH",
      year: "2021",
      colour: "White",
      depot: "Lagos",
    },
    {
      imei: "example-imei-0002",
      sim_number: "08031234567",
      device_model: "Teltonika FMB920",
      protocol: "teltonika",
      plate: "LSD-101-AA",
      vehicle_type: "van",
      make: "Ford",
      model: "Transit",
      year: "2022",
      colour: "Blue",
      chassis_number: "EXAMPLEVIN000000001",
      depot: "Ibadan",
      department: "Distribution",
      driver_name: "Ada Obi",
      driver_phone: "08031000000",
      driver_licence: "LIC-EXAMPLE-01",
    },
  ];
  return Papa.unparse(rows, {
    columns: [...IMPORT_HEADERS],
    newline: "\n",
  });
}

export function errorsCsv(errors: readonly ImportError[]): string {
  return Papa.unparse(
    errors.map((error) => ({ row: error.row, message: error.message })),
    { columns: ["row", "message"], newline: "\n" },
  );
}

function safeStem(fileName: string): string {
  const stem = fileName
    .replace(/\.csv$/i, "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return stem || "vehicles";
}

export function errorsCsvFileName(fileName: string): string {
  return `import-errors-${safeStem(fileName)}.csv`;
}

export function sampleCsvFileName(): string {
  return "fleet-import-sample.csv";
}
