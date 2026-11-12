import { useNavigate, useSearch } from "@tanstack/react-router";
import { safeRedirect } from "../../../app/redirect";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { BrandBar } from "../../../ui/BrandBar";
import { BrandLogo } from "../../../ui/BrandLogo";
import { PageFrame } from "../../../ui/PageFrame";
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
    <div className="bg-bg text-text flex h-dvh flex-col">
      <header className="border-border bg-surface shrink-0 border-b">
        <BrandBar>
          <BrandLogo variant="lockup" />
        </BrandBar>
      </header>

      <PageFrame
        layout="scroll"
        align="center"
        width="full"
        className="flex-1"
        contentClassName="px-4 pt-6"
      >
        <main className="flex w-full justify-center">
          <div className="w-panel max-w-full space-y-4">
            <div className="border-border bg-surface rounded-lg border p-6">
              <h1 className="text-text text-lg font-semibold">Sign in</h1>
              <p className="text-muted mb-4 text-sm">
                Use your Fleet Console account.
              </p>
              <LoginForm
                onSuccess={() => {
                  void completeLogin();
                }}
              />
            </div>
          </div>
        </main>
      </PageFrame>
    </div>
  );
}
