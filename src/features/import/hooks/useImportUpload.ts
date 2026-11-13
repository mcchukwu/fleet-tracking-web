import { useCallback, useRef, useState } from "react";
import { useImportVehicles } from "../../../api/hooks/import";
import type { ImportResult } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";

export type ImportUploadStatus = "idle" | "uploading" | "cancelled" | "success" | "error";

export type ImportUploadOutcome =
  | { status: "success"; result: ImportResult }
  | { status: "cancelled" }
  | { status: "ignored" }
  | { status: "error"; error: AppError };

export interface ImportUploadController {
  status: ImportUploadStatus;
  pending: boolean;
  result: ImportResult | null;
  error: AppError | null;
  upload: (file: File) => Promise<ImportUploadOutcome>;
  cancel: () => void;
  retry: () => void;
  reset: () => void;
}

function markUncertain(cause: unknown): AppError {
  const error = normalize(
    cause,
    { action: "import vehicles", resource: "the import" },
    { outcome: "unknown" },
  );
  if (
    error.outcome === "unknown" &&
    error.kind !== "network" &&
    error.kind !== "timeout" &&
    error.kind !== "aborted"
  ) {
    return { ...error, outcome: "failed" };
  }
  return error;
}

export function useImportUpload(): ImportUploadController {
  const mutation = useImportVehicles();
  const [status, setStatus] = useState<ImportUploadStatus>("idle");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const retryRequested = useRef(false);

  const upload = useCallback(
    async function run(file: File): Promise<ImportUploadOutcome> {
      if (inFlight.current) return { status: "ignored" };

      inFlight.current = true;
      setPending(true);
      setError(null);
      setResult(null);

      try {
        while (true) {
          const request = new AbortController();
          controller.current = request;
          retryRequested.current = false;
          setStatus("uploading");

          try {
            const value = await mutation.mutateAsync({
              file,
              signal: request.signal,
            });
            setResult(value);
            setStatus("success");
            return { status: "success", result: value };
          } catch (cause) {
            if (retryRequested.current) continue;
            if (request.signal.aborted) {
              setStatus("cancelled");
              return { status: "cancelled" };
            }
            const normalized = markUncertain(cause);
            setError(normalized);
            setStatus("error");
            return { status: "error", error: normalized };
          }
        }
      } finally {
        inFlight.current = false;
        controller.current = null;
        retryRequested.current = false;
        setPending(false);
      }
    },
    [mutation],
  );

  const cancel = useCallback(() => {
    retryRequested.current = false;
    controller.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const request = controller.current;
    if (!request) return;
    retryRequested.current = true;
    request.abort();
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, pending, result, error, upload, cancel, retry, reset };
}
