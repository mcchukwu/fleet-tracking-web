import { describe, expect, it } from "vitest";
import {
  buildImportPreview,
  parseImportCsvText,
  parseImportText,
  stripBom,
} from "./preview";

const HEADER =
  "imei,plate,vehicle_type,make,model,year,colour,depot,driver_name,driver_phone";

function dataRows(count: number): string[][] {
  return Array.from({ length: count }, (_, index) => [
    `imei-${index + 1}`,
    `LSD-10${index}-AA`,
    "truck",
    "Volvo",
    "FH",
    "2021",
    "White",
    "Lagos",
    "",
    "",
  ]);
}

describe("import preview", () => {
  it("accepts a valid header row and data rows", () => {
    const result = parseImportText(
      `${HEADER}\nimei-1,LSD-100-AA,truck,Volvo,FH,2021,White,Lagos,Ada,0803\n` +
        "imei-2,LSD-101-AA,van,Ford,Transit,2022,Blue,Ibadan,,",
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.preview.headerRow[0]).toBe("imei");
    expect(result.preview.rows).toHaveLength(2);
    expect(result.preview.rows[0]?.[1]).toBe("LSD-100-AA");
    expect(result.preview.unknownHeaders).toEqual([]);
    expect(result.preview.duplicateHeaders).toEqual([]);
  });

  it("normalises uppercase and padded headers", () => {
    const result = parseImportText(" IMEI , Plate \nimei-1,LSD-100-AA");

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.preview.headers).toEqual(["imei", "plate"]);
    expect(result.preview.headerRow).toEqual(["IMEI", "Plate"]);
  });

  it("warns about unknown headers without blocking", () => {
    const result = parseImportText("imei,plate,colour_code\nimei-1,LSD-100-AA,red");

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.preview.unknownHeaders).toEqual(["colour_code"]);
  });

  it("lists duplicate headers once", () => {
    const result = parseImportText("imei,plate,plate\nimei-1,LSD-100-AA,LSD-100-AA");

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.preview.duplicateHeaders).toEqual(["plate"]);
  });

  it("blocks a file with no imei header, case-insensitively checked after trimming", () => {
    expect(parseImportText("plate,make\nLSD-100-AA,Volvo")).toEqual({
      status: "error",
      issue: "missing-imei",
    });
  });

  it("blocks an empty file", () => {
    expect(parseImportText("")).toEqual({ status: "error", issue: "empty-file" });
    expect(parseImportText("  \n \n")).toEqual({
      status: "error",
      issue: "empty-file",
    });
  });

  it("blocks a header-only file", () => {
    expect(parseImportText("imei,plate\n")).toEqual({
      status: "error",
      issue: "no-data-rows",
    });
  });

  it("strips a UTF-8 BOM and records it", () => {
    const stripped = stripBom("\uFEFFimei,plate\nimei-1,LSD-100-AA");
    expect(stripped.bom).toBe(true);
    expect(stripped.text.startsWith("imei")).toBe(true);

    const result = parseImportText("\uFEFFimei,plate\nimei-1,LSD-100-AA");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.preview.bom).toBe(true);
    expect(result.preview.headers).toEqual(["imei", "plate"]);
  });

  it("forces a comma delimiter and does not guess a semicolon file", () => {
    const result = parseImportText("imei;plate\nimei-1;LSD-100-AA");
    expect(result).toEqual({ status: "error", issue: "missing-imei" });
  });

  it("blocks a file whose quoting cannot be read", () => {
    const result = parseImportText('imei,plate\n"imei-1,"LSD-100-AA');
    expect(result).toEqual({ status: "error", issue: "unreadable" });
  });

  it("keeps only the first five data rows", () => {
    const result = buildImportPreview([["imei", "plate"], ...dataRows(7)]);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.preview.rows).toHaveLength(5);
  });

  it("reports parse errors from a text read", () => {
    const parsed = parseImportCsvText('imei,plate\n"imei-1,"LSD-100-AA');
    expect(parsed.errorCount).toBeGreaterThan(0);
  });

  it("treats a missing header row as unreadable", () => {
    expect(buildImportPreview([])).toEqual({ status: "error", issue: "unreadable" });
  });
});
