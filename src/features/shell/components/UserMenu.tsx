import { ChevronDown, Keyboard, LogOut, UserRound } from "lucide-react";
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
  if (!user) return null;

  return (
    <div className="contents">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Account menu for ${user.name}`}
            className="h-touch text-text hover:bg-surface-2 focus-visible:outline-focus-ring md:h-control-md flex items-center gap-2 rounded-md px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-0"
          >
            <span
              aria-hidden="true"
              className="size-control-sm bg-accent-soft text-accent-fg flex items-center justify-center rounded-full"
            >
              <UserRound className="size-4" strokeWidth={1.5} />
            </span>
            <span
              aria-hidden="true"
              className="hidden max-w-32 truncate lg:inline"
              title={user.name}
            >
              {user.name}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="text-subtle hidden size-3 lg:inline"
              strokeWidth={1.5}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>
            <span
              className="text-text block truncate text-sm"
              title={user.name}
            >
              {user.name}
            </span>
            <span
              className="text-muted block truncate text-xs"
              title={user.email}
            >
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
              <Keyboard
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.5}
              />
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
