import { Link, useRouterState } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../../auth/store";
import { cn } from "../../../ui/cn";
import { Tooltip } from "../../../ui/Tooltip";
import { navForRole } from "../nav";

export function NavRail() {
  const [expanded, setExpanded] = useState(false);
  const user = useAuthStore((state) => state.user);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = navForRole(user?.role);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-surface md:flex",
        expanded ? "w-rail-expanded" : "w-rail",
      )}
    >
      <ul className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const active = pathname === item.to;
          const link = (
            <Link
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-control-lg items-center gap-2 rounded-md text-sm transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring",
                expanded ? "px-2" : "justify-center",
                active
                  ? "bg-accent-soft text-accent-fg"
                  : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <item.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.5} />
              <span className={expanded ? "truncate" : "sr-only"}>{item.label}</span>
            </Link>
          );

          return (
            <li key={item.to}>
              {expanded ? link : <Tooltip label={item.label} side="right">{link}</Tooltip>}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border p-2">
        <Tooltip label={expanded ? "Collapse navigation" : "Expand navigation"} side="right">
          <button
            type="button"
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className={cn(
              "flex h-control-lg items-center gap-2 rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring",
              expanded ? "w-full px-2" : "w-full justify-center",
            )}
          >
            {expanded ? (
              <PanelLeftClose aria-hidden="true" className="size-5" strokeWidth={1.5} />
            ) : (
              <PanelLeftOpen aria-hidden="true" className="size-5" strokeWidth={1.5} />
            )}
            <span className={expanded ? "text-sm" : "sr-only"}>
              {expanded ? "Collapse" : "Expand"}
            </span>
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
