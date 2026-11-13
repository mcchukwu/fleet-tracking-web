import { useEffect, useRef, useState } from "react";
import {
  buildImportPreview,
  readImportFile,
  type ImportPreview,
  type PreviewIssue,
} from "../lib/preview";

export type ImportPreviewState = "idle" | "parsing" | "ready" | "error";

export interface ImportPreviewController {
  state: ImportPreviewState;
  preview: ImportPreview | null;
  issue: PreviewIssue | null;
}

function extensionIsCsv(name: string): boolean {
  return name.toLowerCase().endsWith(".csv");
}

export function useImportPreview(file: File | null): ImportPreviewController {
  const [state, setState] = useState<ImportPreviewState>(file ? "parsing" : "idle");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [issue, setIssue] = useState<PreviewIssue | null>(null);
  const requestId = useRef(0);

  // oxlint-disable react/set-state-in-effect -- a new File is an external event; the old preview must clear before the next parse settles.
  useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;
    let active = true;

    setPreview(null);
    setIssue(null);

    if (!file) {
      setState("idle");
      return;
    }
    if (!extensionIsCsv(file.name)) {
      setIssue("wrong-type");
      setState("error");
      return;
    }
    if (file.size === 0) {
      setIssue("empty-file");
      setState("error");
      return;
    }

    setState("parsing");
    void readImportFile(file)
      .then((parsed) => {
        if (!active || requestId.current !== id) return;
        if (parsed.errorCount > 0) {
          setIssue("unreadable");
          setState("error");
          return;
        }
        const result = buildImportPreview(parsed.rows, { bom: parsed.bom });
        if (result.status === "error") {
          setIssue(result.issue);
          setState("error");
          return;
        }
        setPreview(result.preview);
        setState("ready");
      })
      .catch(() => {
        if (!active || requestId.current !== id) return;
        setIssue("unreadable");
        setState("error");
      });

    return () => {
      active = false;
    };
  }, [file]);
  // oxlint-enable react/set-state-in-effect

  return { state, preview, issue };
}
