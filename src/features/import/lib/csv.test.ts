import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { errorsCsv, errorsCsvFileName, importHeaderRow, sampleCsv, sampleCsvFileName } from "./csv";
import { IMPORT_HEADERS } from "./constants";

describe("import CSV helpers", () => {
  it("renders exactly the approved header names in order", () => {
    expect(importHeaderRow()).toBe(IMPORT_HEADERS.join(","));
    expect(importHeaderRow().split(",")).toEqual([
      "imei",
      "sim_number",
      "device_model",
      "protocol",
      "plate",
      "vehicle_type",
      "make",
      "model",
      "year",
      "colour",
      "chassis_number",
      "depot",
      "department",
      "driver_name",
      "driver_phone",
      "driver_licence",
    ]);
  });

  it("generates a sample with every header and two example rows", () => {
    const parsed = Papa.parse<string[]>(sampleCsv(), {
      header: false,
      skipEmptyLines: "greedy",
    });
    expect(parsed.data[0]).toEqual([...IMPORT_HEADERS]);
    expect(parsed.data).toHaveLength(3);
    expect(parsed.data[1]?.[0]).toBe("example-imei-0001");
    expect(parsed.data[2]?.[0]).toBe("example-imei-0002");
    expect(sampleCsv()).not.toContain("demo-imei");
  });

  it("escapes commas, quotes and newlines in the errors CSV", () => {
    const text = errorsCsv([
      { row: 2, message: 'Plate "KJA, 123" is invalid' },
      { row: 4, message: "Line one\nLine two" },
    ]);
    const parsed = Papa.parse<{ row: string; message: string }>(text, {
      header: true,
      skipEmptyLines: "greedy",
    });

    expect(parsed.data).toEqual([
      { row: "2", message: 'Plate "KJA, 123" is invalid' },
      { row: "4", message: "Line one\nLine two" },
    ]);
  });

  it("produces predictable filenames", () => {
    expect(errorsCsvFileName("Fleet Import 09.CSV")).toBe("import-errors-fleet-import-09.csv");
    expect(errorsCsvFileName("")).toBe("import-errors-vehicles.csv");
    expect(sampleCsvFileName()).toBe("fleet-import-sample.csv");
  });
});
