import { forwardRef, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../auth/store";
import { TooltipProvider } from "../../../ui/Tooltip";
import { MobileNav } from "./MobileNav";
import { NavRail } from "./NavRail";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  const MockLink = forwardRef<
    HTMLAnchorElement,
    { to: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>
  >(function MockLink({ to, children, onClick, ...props }, ref) {
    return (
      <a
        ref={ref}
        href={to}
        {...props}
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
        }}
      >
        {children}
      </a>
    );
  });

  return {
    ...actual,
    Link: MockLink,
    useRouterState: ({
      select,
    }: {
      select: (state: { location: { pathname: string } }) => unknown;
    }) => select({ location: { pathname: "/map" } }),
  };
});

const dispatcher = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

beforeEach(() => {
  useAuthStore.setState({ user: dispatcher, csrfToken: "token", status: "authenticated" });
});

describe("NavRail", () => {
  it("marks the active route and exposes an accessible name when collapsed", () => {
    render(
      <TooltipProvider>
        <NavRail />
      </TooltipProvider>,
    );

    expect(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Alerts" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument();
  });

  it("shows a tooltip for a collapsed item", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <NavRail />
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole("link", { name: "Alerts" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Alerts");
  });

  it("expands to show labels", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <NavRail />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(screen.getByRole("button", { name: "Collapse navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Alerts")).not.toHaveClass("sr-only");
  });
});

function MobileHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open navigation
      </button>
      <MobileNav open={open} onClose={() => setOpen(false)} />
    </>
  );
}

describe("MobileNav", () => {
  it("opens as a modal menu, marks the active item and returns focus", async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("closes after choosing a destination", async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.click(screen.getByRole("link", { name: "Alerts" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
