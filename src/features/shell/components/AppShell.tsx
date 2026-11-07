import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ErrorBoundary } from "../../../errors/ErrorBoundary";
import { LiveProvider } from "../../../live/LiveProvider";
import { useShortcuts } from "../hooks/useShortcuts";
import type { NavPath } from "../nav";
import { GlobalBanners } from "./GlobalBanners";
import { MobileNav } from "./MobileNav";
import { NavRail } from "./NavRail";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { TopBar } from "./TopBar";

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const go = useCallback(
    (path: NavPath) => {
      void navigate({ to: path });
    },
    [navigate],
  );
  const clearTransientView = useCallback(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("q") && !url.searchParams.has("v")) return;
    url.searchParams.delete("q");
    url.searchParams.delete("v");
    void navigate({ href: `${url.pathname}${url.search}`, replace: true });
  }, [navigate]);

  useShortcuts({ onOpenShortcuts: openShortcuts, onNavigate: go, onEscape: clearTransientView });

  return (
    <LiveProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-bg text-text">
      <TopBar onOpenMenu={() => setMenuOpen(true)} onOpenShortcuts={openShortcuts} />
      <GlobalBanners />

      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-auto focus:outline-none">
          <ErrorBoundary level="route" resetKeys={[pathname]}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

        <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </LiveProvider>
  );
}
