import { useNavigate, useSearch } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { safeRedirect } from "../../../app/redirect";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { LoginForm } from "./LoginForm";

export function LoginPage() {
  useDocumentTitle("Sign in");
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });

  async function completeLogin(): Promise<void> {
    await navigate({ href: safeRedirect(search.redirect) });
    requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>("main");
      if (!main) return;
      main.tabIndex = -1;
      main.focus();
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-8 text-text">
      <div className="w-panel max-w-full space-y-4">
        <div className="flex items-center justify-center gap-2">
          <span className="flex size-control-lg items-center justify-center rounded-md bg-accent text-text-inverse">
            <Truck aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </span>
          <span className="text-md font-medium text-text">Fleet Console</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold text-text">Sign in</h1>
          <p className="mb-4 text-sm text-muted">Use your Fleet Console account.</p>
          <LoginForm
            onSuccess={() => {
              void completeLogin();
            }}
          />
        </div>
      </div>
    </main>
  );
}
