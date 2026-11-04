import { ChevronDown, Keyboard, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLogoutMutation } from "../../../api/hooks/auth";
import { useAuthStore } from "../../../auth/store";
import { useTheme, type ThemeMode } from "../../../theme/theme-context";
import { Badge } from "../../../ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import { useToast } from "../../../ui/Toast";

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export interface UserMenuProps {
  onShortcuts?: () => void;
}

export function UserMenu({ onShortcuts }: UserMenuProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useLogoutMutation();
  const navigate = useNavigate();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  if (!user) return null;

  async function signOut(): Promise<void> {
    const failure = await logout
      .mutateAsync()
      .then(() => null)
      .catch((cause: unknown) => cause);

    if (failure) {
      toast({
        tone: "error",
        title: "Signed out on this device. The server couldn't be reached.",
        key: "logout-failed",
      });
    }
    await navigate({ to: "/login" });
  }

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

        <DropdownMenuContent align="end" container={portalContainer} className="w-64">
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

          <div className="md:hidden">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Sun aria-hidden="true" className="size-4" strokeWidth={1.5} />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={mode}
                  onValueChange={(value) => setMode(value as ThemeMode)}
                >
                  {themeOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      <option.icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>

          {onShortcuts ? (
            <DropdownMenuItem onSelect={onShortcuts}>
              <Keyboard aria-hidden="true" className="size-4" strokeWidth={1.5} />
              Keyboard shortcuts
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()} className="text-danger">
            <LogOut aria-hidden="true" className="size-4" strokeWidth={1.5} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
