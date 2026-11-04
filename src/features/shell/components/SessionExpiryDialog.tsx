import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLogoutMutation } from "../../../api/hooks/auth";
import { useAuthStore } from "../../../auth/store";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { LoginForm } from "../../login/components/LoginForm";

export function SessionExpiryDialog() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const logout = useLogoutMutation();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (status === "expired") previousUserId.current = user?.id ?? null;
  }, [status, user?.id]);

  async function resume(): Promise<void> {
    const nextUser = useAuthStore.getState().user;
    const previous = previousUserId.current;
    previousUserId.current = null;

    if (nextUser && previous && nextUser.id !== previous) {
      queryClient.clear();
      await router.invalidate();
      return;
    }
    await queryClient.refetchQueries({ type: "active" });
  }

  async function signOut(): Promise<void> {
    const redirect = `${window.location.pathname}${window.location.search}`;
    await logout.mutateAsync().catch(() => undefined);
    await navigate({ to: "/login", search: { redirect } });
  }

  if (status !== "expired") return null;

  return (
    <Dialog
      open
      onOpenChange={() => undefined}
      variant="blocking"
      title="Your session expired"
      description="Sign in to continue. You'll stay where you are."
      footer={
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      }
    >
      <LoginForm
        variant="dialog"
        onSuccess={() => {
          void resume();
        }}
      />
    </Dialog>
  );
}
