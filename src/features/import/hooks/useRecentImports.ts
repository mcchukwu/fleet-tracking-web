import { useCallback, useEffect, useRef, useState } from "react";
import {
  addImportHistory,
  readImportHistory,
  type RecentImport,
} from "../../../lib/importHistory";
import { normalize } from "../../../errors/normalize";
import type { AppError } from "../../../errors/types";

export type RecentImportsState = "loading" | "ready" | "error";

export interface RecentImportsController {
  entries: RecentImport[];
  state: RecentImportsState;
  error: AppError | null;
  add: (entry: RecentImport) => Promise<boolean>;
  retry: () => Promise<void>;
}

export function useRecentImports(): RecentImportsController {
  const [entries, setEntries] = useState<RecentImport[]>([]);
  const [state, setState] = useState<RecentImportsState>("loading");
  const [error, setError] = useState<AppError | null>(null);
  const pendingEntry = useRef<RecentImport | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      setEntries(await readImportHistory());
      setState("ready");
    } catch (cause) {
      setError(
        normalize(cause, {
          action: "load import history",
          resource: "recent imports",
        }),
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- the IndexedDB read is the external event that replaces the loading state.
    void load();
  }, [load]);

  const add = useCallback(async (entry: RecentImport): Promise<boolean> => {
    pendingEntry.current = entry;
    try {
      const next = await addImportHistory(entry);
      setEntries(next);
      setError(null);
      setState("ready");
      pendingEntry.current = null;
      return true;
    } catch (cause) {
      setError(
        normalize(cause, {
          action: "save import history",
          resource: "recent imports",
        }),
      );
      return false;
    }
  }, []);

  const retry = useCallback(async () => {
    const entry = pendingEntry.current;
    if (entry) {
      await add(entry);
      return;
    }
    await load();
  }, [add, load]);

  return { entries, state, error, add, retry };
}
