import type { ImportResult } from "../../../api/types";
import { errorCopy, isSafeServerCode } from "../../../errors/catalog";
import type { AppError } from "../../../errors/types";
import { formatCount } from "../../../lib/format";
import type { PreviewIssue } from "./preview";

export interface ImportCopy {
  title: string;
  detail: string;
}

export function previewIssueCopy(issue: PreviewIssue): ImportCopy {
  switch (issue) {
    case "wrong-type":
      return {
        title: "Choose a .csv file.",
        detail: "Only comma-separated .csv files are supported.",
      };
    case "empty-file":
      return {
        title: "This file is empty.",
        detail: "Choose a .csv with a header row and at least one vehicle.",
      };
    case "no-data-rows":
      return {
        title: "This file has no data rows.",
        detail: "Add at least one vehicle row and choose the file again.",
      };
    case "missing-imei":
      return {
        title: "This file has no imei column.",
        detail: "Add an imei header and try again. Columns must be comma-separated.",
      };
    case "unreadable":
      return {
        title: "Couldn't read this file.",
        detail: "Check the CSV header row and try again.",
      };
  }
}

function plural(count: number, singular: string, pluralWord: string): string {
  return count === 1 ? singular : pluralWord;
}

export function resultSentence(
  result: Pick<ImportResult, "total" | "imported" | "failed">,
): string {
  if (result.total === 0) return "No rows to import.";
  if (result.imported === 0) {
    const failed = formatCount(result.failed);
    return `No vehicles imported. ${failed} ${plural(result.failed, "row", "rows")} failed.`;
  }
  const imported = formatCount(result.imported);
  const vehicles = plural(result.imported, "vehicle", "vehicles");
  if (result.failed === 0) return `${imported} ${vehicles} imported.`;
  const failed = formatCount(result.failed);
  return `${imported} ${vehicles} imported, ${failed} ${plural(result.failed, "row", "rows")} failed.`;
}

export function importFailureCopy(error: AppError): ImportCopy {
  if (error.kind === "aborted") {
    return { title: "Upload cancelled", detail: "Nothing was imported." };
  }
  if (error.kind === "unauthenticated") {
    return {
      title: "Your session expired.",
      detail: "Sign in, then try again. Your file is still selected.",
    };
  }
  if (error.kind === "forbidden") {
    return {
      title: "Your role can't import vehicles.",
      detail: "Ask an admin if you need access.",
    };
  }
  if (error.code === "invalid_csv") {
    return {
      title: "Couldn't read this file",
      detail:
        isSafeServerCode(error.code) && error.serverMessage
          ? error.serverMessage
          : "Check the CSV header row and try again.",
    };
  }
  if (error.outcome === "unknown") {
    return {
      title: "We couldn't confirm the import",
      detail: "It's safe to upload again.",
    };
  }
  if (error.kind === "validation") {
    return {
      title: "Couldn't import this file",
      detail:
        error.code === "invalid_request"
          ? "Try again. Your file is still selected."
          : isSafeServerCode(error.code) && error.serverMessage
            ? error.serverMessage
            : "Check the file and try again.",
    };
  }
  const copy = errorCopy(error);
  return { title: copy.title, detail: copy.detail };
}
