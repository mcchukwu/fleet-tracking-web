import { Link } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FOCUS_SEARCH_EVENT } from "../../../lib/keyboard";
import { useConnection } from "../../../stores/connection";
import { ConnectionIndicator, type ConnectionState } from "../../../ui/Badge";
import { BrandBar } from "../../../ui/BrandBar";
import { BrandLogo } from "../../../ui/BrandLogo";
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
    window.addEventListener(FOCUS_SEARCH_EVENT, focusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focusSearch);
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
    <header className="z-topbar border-border bg-surface shrink-0 border-b">
      <BrandBar className="gap-2">
        <Link
          to="/map"
          className="h-touch min-w-touch focus-visible:outline-focus-ring flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="hidden md:inline-flex">
            <BrandLogo variant="lockup" />
          </span>
          <span className="md:hidden">
            <BrandLogo variant="symbol" />
          </span>
        </Link>

        <IconButton
          className="md:hidden"
          label="Open navigation"
          onClick={onOpenMenu}
          icon={<Menu aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        />

        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
          <div className="max-w-panel w-full">
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
          <ConnectionIndicator state={connection} compact />
          <UserMenu onShortcuts={onOpenShortcuts} />
        </div>
      </BrandBar>

      {searchOpen ? (
        <div className="border-border flex items-center gap-2 border-t px-4 py-2 md:hidden">
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
