import { Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorBoundary } from "../../../errors/ErrorBoundary";
import { MobileNav } from "./MobileNav";
import { NavRail } from "./NavRail";
import { TopBar } from "./TopBar";

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text">
      <TopBar onOpenMenu={() => setMenuOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-auto focus:outline-none">
          <ErrorBoundary level="route" resetKeys={[pathname]}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
