import { useCallback, useRef, useState } from "react";
import { useLoginMutation } from "../../../api/hooks/auth";
import { normalize } from "../../../errors/normalize";
import { getSlowState, type SlowState } from "../../../errors/slow";
import type { AppError } from "../../../errors/types";
import { useClock } from "./useClock";

export type LoginOutcome =
  | { status: "success" }
  | { status: "error"; error: AppError; clearPassword: boolean }
  | { status: "aborted" }
  | { status: "busy" };

export interface UseLoginResult {
  submit: (email: string, password: string) => Promise<LoginOutcome>;
  retry: (email: string, password: string) => Promise<LoginOutcome>;
  cancel: () => void;
  reset: () => void;
  error: AppError | null;
  slow: SlowState | null;
  pending: boolean;
}

export function useLogin(): UseLoginResult {
  const { mutateAsync } = useLoginMutation();
  const [error, setError] = useState<AppError | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const task = useRef<Promise<LoginOutcome> | null>(null);
  const pending = startedAt !== null;
  const now = useClock(startedAt !== null);
  const slow: SlowState | null =
    startedAt === null ? null : getSlowState(startedAt, now);

  const submit = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      if (inFlight.current) return { status: "busy" };

      inFlight.current = true;
      setError(null);
      setStartedAt(Date.now());
      const aborter = new AbortController();
      controller.current = aborter;

      const run = async (): Promise<LoginOutcome> => {
        try {
          await mutateAsync({ email, password, signal: aborter.signal });
          return { status: "success" };
        } catch (cause) {
          const normalized = normalize(cause, { action: "sign in", resource: "login" });
          if (normalized.kind === "aborted") return { status: "aborted" };
          setError(normalized);
          return {
            status: "error",
            error: normalized,
            clearPassword: normalized.kind === "unauthenticated",
          };
        } finally {
          inFlight.current = false;
          controller.current = null;
          task.current = null;
          setStartedAt(null);
        }
      };

      const promise = run();
      task.current = promise;
      return promise;
    },
    [mutateAsync],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);

  const retry = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      controller.current?.abort();
      if (task.current) await task.current.catch(() => undefined);
      return submit(email, password);
    },
    [submit],
  );

  const reset = useCallback(() => setError(null), []);

  return { submit, retry, cancel, reset, error, slow, pending };
}
