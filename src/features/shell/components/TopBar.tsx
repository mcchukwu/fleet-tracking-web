import { Link } from "@tanstack/react-router";
import { Menu, Search, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useConnection } from "../../../stores/connection";
import { ThemeToggle } from "../../../theme/ThemeToggle";
import { ConnectionIndicator, type ConnectionState } from "../../../ui/Badge";
import { IconButton } from "../../../ui/IconButton";
import { GlobalSearch } from "./GlobalSearch";
import { UserMenu } from "./UserMenu";

export interface TopBarProps {
  onOpenMenu: () => void;
  onOpenShortcuts?: () => void;
}

export function TopBar({ onOpenMenu, onOpenShortcuts }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { network, socket } = useConnection();

  useEffect(() => {
    const focusSearch = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        document.getElementById("vehicle-search")?.focus();
        return;
      }
      setSearchOpen(true);
    };
    window.addEventListener("fleet:focus-search", focusSearch);
    return () => window.removeEventListener("fleet:focus-search", focusSearch);
  }, []);
  const connection: ConnectionState =
    network === "offline"
      ? "offline"
      : socket === "live"
        ? "live"
        : socket === "reconnecting"
          ? "reconnecting"
          : "online";

  return (
    <header className="z-40 shrink-0 border-b border-border bg-surface">
      <div className="flex h-topbar items-center gap-2 px-3">
        <IconButton
          className="md:hidden"
          label="Open navigation"
          onClick={onOpenMenu}
          icon={<Menu aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        />

        <Link
          to="/map"
          aria-label="Fleet Console home"
          className="flex h-touch w-touch shrink-0 items-center justify-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring sm:w-auto sm:justify-start md:h-auto"
        >
          <span className="flex size-control-sm items-center justify-center rounded-md bg-accent text-text-inverse">
            <Truck aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </span>
          <span className="hidden text-sm font-medium text-text sm:inline">Fleet Console</span>
        </Link>

        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
          <div className="w-full max-w-panel">
            <GlobalSearch />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <IconButton
            className="md:hidden"
            label={searchOpen ? "Close search" : "Search vehicles"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
            icon={
              searchOpen ? (
                <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
              ) : (
                <Search aria-hidden="true" className="size-4" strokeWidth={1.5} />
              )
            }
          />
          <span className="hidden md:inline">
            <ThemeToggle />
          </span>
          <ConnectionIndicator state={connection} compact />
          <UserMenu onShortcuts={onOpenShortcuts} />
        </div>
      </div>

      {searchOpen ? (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2 md:hidden">
          <GlobalSearch
            inputId="vehicle-search-mobile"
            focusOnMount
            onSubmitted={() => setSearchOpen(false)}
          />
          <IconButton
            label="Close search"
            onClick={() => setSearchOpen(false)}
            icon={<X aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          />
        </div>
      ) : null}
    </header>
  );
}
