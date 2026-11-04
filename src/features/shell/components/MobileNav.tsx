import { Link, useRouterState } from "@tanstack/react-router";
import { useAuthStore } from "../../../auth/store";
import { cn } from "../../../ui/cn";
import { Dialog } from "../../../ui/Dialog";
import { navForRole } from "../nav";

export interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const user = useAuthStore((state) => state.user);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = navForRole(user?.role);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="Navigation">
      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname === item.to;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  onClick={onClose}
                  className={cn(
                    "flex h-touch items-center gap-2 rounded-md px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring",
                    active
                      ? "bg-accent-soft text-accent-fg"
                      : "text-text hover:bg-surface-2",
                  )}
                >
                  <item.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.5} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </Dialog>
  );
}
