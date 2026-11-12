import { ChevronDown, Download, Keyboard, LogOut, UserRound } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuthStore } from "../../../auth/store";
import {
  captureInstallPrompt,
  installAvailable,
  promptInstall,
  subscribeInstall,
} from "../../../pwa/install";
import { pwaCopy } from "../../../pwa/copy";
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
  const verified = useAuthStore((state) => state.sessionVerified);
  const { signOut, pending } = useSignOut();
  const installReady = useSyncExternalStore(subscribeInstall, installAvailable, () => false);
  const [installPending, setInstallPending] = useState(false);

  useEffect(() => captureInstallPrompt(), []);

  if (!user) return null;

  const install = () => {
    if (installPending) return;
    setInstallPending(true);
    void promptInstall().finally(() => setInstallPending(false));
  };

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
            <span className="mt-1 flex flex-wrap items-center gap-1">
              <Badge tone="accent" className="capitalize">
                {user.role}
              </Badge>
              {verified ? null : (
                <span title={pwaCopy.unverifiedDescription}>
                  <Badge tone="neutral">{pwaCopy.unverifiedOffline}</Badge>
                  <span className="sr-only">{pwaCopy.unverifiedDescription}</span>
                </span>
              )}
            </span>
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
          {installReady ? (
            <DropdownMenuItem onSelect={install} disabled={installPending}>
              <Download aria-hidden="true" className="size-4" strokeWidth={1.5} />
              {installPending ? pwaCopy.installing : pwaCopy.install}
            </DropdownMenuItem>
          ) : null}
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
