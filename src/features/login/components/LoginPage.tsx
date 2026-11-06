import { useNavigate, useSearch } from "@tanstack/react-router";
import { safeRedirect } from "../../../app/redirect";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { BrandBar } from "../../../ui/BrandBar";
import { BrandLogo } from "../../../ui/BrandLogo";
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
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="shrink-0 border-b border-border bg-surface">
        <BrandBar>
          <BrandLogo variant="lockup" />
        </BrandBar>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-panel max-w-full space-y-4">
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
    </div>
  );
}
