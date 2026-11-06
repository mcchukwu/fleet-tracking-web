import { ChevronDown, Keyboard, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../../auth/store";
import { AppearanceControls } from "../../../theme/AppearanceControls";
import { Badge } from "../../../ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import { useSignOut } from "../hooks/useSignOut";

export interface UserMenuProps {
  onShortcuts?: () => void;
}

export function UserMenu({ onShortcuts }: UserMenuProps) {
  const user = useAuthStore((state) => state.user);
  const { signOut, pending } = useSignOut();
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  if (!user) return null;

  return (
    <div ref={setPortalContainer} className="contents">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Account menu for ${user.name}`}
            className="flex h-touch items-center gap-2 rounded-md px-2 text-sm text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring md:h-control-md"
          >
            <span
              aria-hidden="true"
              className="flex size-control-sm items-center justify-center rounded-full bg-accent-soft text-accent-fg"
            >
              <UserRound className="size-4" strokeWidth={1.5} />
            </span>
            <span aria-hidden="true" className="hidden max-w-32 truncate lg:inline" title={user.name}>
              {user.name}
            </span>
            <ChevronDown aria-hidden="true" className="hidden size-3 text-subtle lg:inline" strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" container={portalContainer} className="w-72">
          <DropdownMenuLabel>
            <span className="block truncate text-sm text-text" title={user.name}>
              {user.name}
            </span>
            <span className="block truncate text-xs text-muted" title={user.email}>
              {user.email}
            </span>
            <Badge tone="accent" className="mt-1 capitalize">
              {user.role}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <AppearanceControls />

          <DropdownMenuSeparator />
          {onShortcuts ? (
            <DropdownMenuItem onSelect={onShortcuts}>
              <Keyboard aria-hidden="true" className="size-4" strokeWidth={1.5} />
              Keyboard shortcuts
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => void signOut()}
            disabled={pending}
            className="text-danger"
          >
            <LogOut aria-hidden="true" className="size-4" strokeWidth={1.5} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
