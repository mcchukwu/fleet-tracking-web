import Papa from "papaparse";
import { IMPORT_HEADERS, PREVIEW_ROW_LIMIT } from "./constants";

export type PreviewIssue =
  "wrong-type" | "empty-file" | "no-data-rows" | "missing-imei" | "unreadable";

export interface ImportPreview {
  headers: string[];
  headerRow: string[];
  rows: string[][];
  unknownHeaders: string[];
  duplicateHeaders: string[];
  bom: boolean;
}

export type PreviewParseResult =
  { status: "ready"; preview: ImportPreview } | { status: "error"; issue: PreviewIssue };

const knownHeaders: ReadonlySet<string> = new Set(IMPORT_HEADERS);
const previewConfig = {
  header: false as const,
  delimiter: ",",
  preview: PREVIEW_ROW_LIMIT + 1,
  skipEmptyLines: "greedy" as const,
};

function textCell(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase();
}

export function stripBom(text: string): { text: string; bom: boolean } {
  return text.startsWith("\uFEFF") ? { text: text.slice(1), bom: true } : { text, bom: false };
}

export function parseImportCsvText(text: string): {
  rows: string[][];
  errorCount: number;
} {
  const parsed = Papa.parse<string[]>(text, previewConfig);
  return {
    rows: parsed.data.map((row) => row.map(textCell)),
    errorCount: parsed.errors.length,
  };
}

export function buildImportPreview(
  rows: string[][],
  options: { bom?: boolean } = {},
): PreviewParseResult {
  const [header, ...dataRows] = rows;
  if (!header || header.length === 0) {
    return { status: "error", issue: "unreadable" };
  }

  const headerRow = header.map(textCell);
  const headers = headerRow.map(normaliseHeader);
  if (headers.every((value) => value === "")) {
    return { status: "error", issue: "unreadable" };
  }
  if (!headers.includes("imei")) {
    return { status: "error", issue: "missing-imei" };
  }

  const seen = new Map<string, number>();
  for (const value of headers) {
    if (!value) continue;
    seen.set(value, (seen.get(value) ?? 0) + 1);
  }
  const duplicateHeaders = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
  const unknownHeaders = headers.filter((value) => value !== "" && !knownHeaders.has(value));

  const previewRows: string[][] = [];
  for (const row of dataRows) {
    if (previewRows.length >= PREVIEW_ROW_LIMIT) break;
    if (row.every((cell) => textCell(cell) === "")) continue;
    previewRows.push(row.map(textCell));
  }
  if (previewRows.length === 0) {
    return { status: "error", issue: "no-data-rows" };
  }

  return {
    status: "ready",
    preview: {
      headers,
      headerRow,
      rows: previewRows,
      unknownHeaders,
      duplicateHeaders,
      bom: options.bom ?? false,
    },
  };
}

export function parseImportText(text: string): PreviewParseResult {
  const { text: withoutBom, bom } = stripBom(text);
  if (withoutBom.trim() === "") {
    return { status: "error", issue: "empty-file" };
  }
  const parsed = parseImportCsvText(withoutBom);
  if (parsed.errorCount > 0) {
    return { status: "error", issue: "unreadable" };
  }
  return buildImportPreview(parsed.rows, { bom });
}

export interface ParsedImportFile {
  rows: string[][];
  bom: boolean;
  errorCount: number;
}

async function detectBom(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  return head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
}

/** Reads only the preview block, so a 5,000-row file is never parsed in full. */
export async function readImportFile(file: File): Promise<ParsedImportFile> {
  const bom = await detectBom(file);
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      ...previewConfig,
      complete: (parsed) => {
        resolve({
          rows: parsed.data.map((row) => row.map(textCell)),
          bom,
          errorCount: parsed.errors.length,
        });
      },
      error: (cause) => reject(cause),
    });
  });
}
