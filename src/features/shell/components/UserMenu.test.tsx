import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import { useAuthStore } from "../../../auth/store";
import { ApiError } from "../../../errors/types";
import { ThemeProvider } from "../../../theme/ThemeProvider";
import { ToastProvider } from "../../../ui/Toast";
import { UserMenu } from "./UserMenu";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

function renderMenu(onShortcuts = vi.fn()) {
  const queryClient = new QueryClient();
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <UserMenu onShortcuts={onShortcuts} />
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { onShortcuts };
}

beforeEach(() => {
  navigate.mockReset();
  useAuthStore.setState({ user, csrfToken: "token", status: "authenticated" });
});

describe("UserMenu", () => {
  it("shows the name, email and role and invokes shortcuts", async () => {
    const userEventApi = userEvent.setup();
    const { onShortcuts } = renderMenu();

    await userEventApi.click(screen.getByRole("button", { name: `Account menu for ${user.name}` }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText(user.name)).toBeVisible();
    expect(within(menu).getByText(user.email)).toBeVisible();
    expect(within(menu).getByText("dispatcher")).toBeVisible();

    await userEventApi.click(screen.getByRole("menuitem", { name: "Keyboard shortcuts" }));
    expect(onShortcuts).toHaveBeenCalledOnce();
  });

  it("signs out, clears the session and navigates to login", async () => {
    const userEventApi = userEvent.setup();
    vi.spyOn(api, "logout").mockResolvedValue(undefined);
    renderMenu();

    await userEventApi.click(screen.getByRole("button", { name: `Account menu for ${user.name}` }));
    await userEventApi.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login" }));
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("still signs out locally and says the server was unreachable", async () => {
    const userEventApi = userEvent.setup();
    vi.spyOn(api, "logout").mockRejectedValue(new TypeError("Failed to fetch"));
    renderMenu();

    await userEventApi.click(screen.getByRole("button", { name: `Account menu for ${user.name}` }));
    await userEventApi.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByText("Signed out on this device")).toBeVisible();
    expect(
      screen.getByText(
        "The server couldn't be reached, so your session may still be active there.",
      ),
    ).toBeVisible();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login" }));
  });

  it("distinguishes a rejected logout from an unreachable server", async () => {
    const userEventApi = userEvent.setup();
    vi.spyOn(api, "logout").mockRejectedValue(
      new ApiError(403, "forbidden", "forbidden"),
    );
    renderMenu();

    await userEventApi.click(screen.getByRole("button", { name: `Account menu for ${user.name}` }));
    await userEventApi.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByText("Signed out on this device")).toBeVisible();
    expect(
      screen.getByText("The server didn't end the session, so it may still be active there."),
    ).toBeVisible();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login" }));
  });

  it("returns focus to the trigger when the menu closes", async () => {
    const userEventApi = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: `Account menu for ${user.name}` });

    await userEventApi.click(trigger);
    await userEventApi.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
