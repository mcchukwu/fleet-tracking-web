import { useEffect } from "react";
import { errorCopy } from "../../../errors/catalog";
import type { AppError } from "../../../errors/types";
import { useToast } from "../../../ui/Toast";

const storageError = {
  kind: "storage",
  retryable: false,
  outcome: "failed",
  context: { route: "/" },
  at: 0,
} satisfies AppError;

let pending = false;
let consumed = false;

function note(): void {
  if (consumed) return;
  pending = true;
}

if (typeof window !== "undefined") {
  window.addEventListener("fleet:storage-unavailable", note);
}

/** Test seam: the once-per-session notice is module state. */
export function resetStorageNoticeForTests(): void {
  pending = false;
  consumed = false;
}

/**
 * One toast per session when IndexedDB cannot be read or written. Online
 * behaviour is unchanged; the notice explains the reduced offline capability.
 */
export function StorageNotice() {
  const { toast } = useToast();

  useEffect(() => {
    const show = () => {
      if (consumed) return;
      consumed = true;
      pending = false;
      const copy = errorCopy(storageError);
      toast({
        tone: "error",
        title: copy.title,
        description: copy.detail,
        key: "storage-unavailable",
      });
    };

    if (pending) show();
    window.addEventListener("fleet:storage-unavailable", show);
    return () => window.removeEventListener("fleet:storage-unavailable", show);
  }, [toast]);

  return null;
}
