import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useLogoutMutation } from "../../../api/hooks/auth";
import { normalize } from "../../../errors/normalize";
import type { AppErrorKind } from "../../../errors/types";
import { useToast } from "../../../ui/Toast";
import { resetConnection } from "../../../stores/connection";
import { useLiveStore } from "../../../stores/live";

const unreachableKinds: ReadonlySet<AppErrorKind> = new Set(["network", "offline", "timeout"]);

export interface SignOutOptions {
  redirect?: string;
}

export interface SignOutResult {
  signOut: (options?: SignOutOptions) => Promise<void>;
  pending: boolean;
}

export function useSignOut(): SignOutResult {
  const { mutateAsync, isPending } = useLogoutMutation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const signOut = useCallback(
    async ({ redirect }: SignOutOptions = {}) => {
      const failure = await mutateAsync()
        .then(() => null)
        .catch((cause: unknown) => cause);

      if (failure !== null) {
        const error = normalize(failure, { action: "sign out" });
        toast({
          tone: "error",
          title: "Signed out on this device",
          description: unreachableKinds.has(error.kind)
            ? "The server couldn't be reached, so your session may still be active there."
            : "The server didn't end the session, so it may still be active there.",
          key: "logout-failed",
        });
      }

      useLiveStore.getState().reset();
      resetConnection();
      queryClient.clear();

      await navigate(
        redirect === undefined ? { to: "/login" } : { to: "/login", search: { redirect } },
      );
    },
    [mutateAsync, navigate, queryClient, toast],
  );

  return { signOut, pending: isPending };
}
