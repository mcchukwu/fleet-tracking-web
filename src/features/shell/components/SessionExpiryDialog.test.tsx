import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import { useAuthStore } from "../../../auth/store";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { SessionExpiryDialog } from "./SessionExpiryDialog";

const { navigate, invalidate } = vi.hoisted(() => ({
  navigate: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => navigate,
    useRouter: () => ({ invalidate }),
  };
});

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

const otherUser = {
  ...user,
  id: "user-2",
  email: "security@demo.ftb",
  name: "Demo Security",
  role: "security" as const,
};

function renderDialog() {
  const queryClient = new QueryClient();
  const refetchSpy = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue(undefined);
  const clearSpy = vi.spyOn(queryClient, "clear");
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionExpiryDialog />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { queryClient, refetchSpy, clearSpy };
}

async function reauthenticate(email = user.email) {
  const userEventApi = userEvent.setup();
  await userEventApi.type(screen.getByLabelText("Email"), email);
  await userEventApi.type(screen.getByLabelText("Password"), "DemoPass123!");
  await userEventApi.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  navigate.mockReset();
  invalidate.mockReset();
  useAuthStore.setState({ user, csrfToken: "token", status: "expired" });
});

describe("SessionExpiryDialog", () => {
  it("is blocking: Escape and outside clicks do not close it", async () => {
    const userEventApi = userEvent.setup();
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Your session expired" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();

    await userEventApi.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Your session expired" })).toBeVisible();
  });

  it("refetches active queries and closes when the same user signs in", async () => {
    vi.spyOn(api, "login").mockResolvedValue({ user, csrf_token: "token" });
    const { refetchSpy } = renderDialog();

    await reauthenticate();

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Your session expired" })).not.toBeInTheDocument();
    });
    expect(refetchSpy).toHaveBeenCalledWith({ type: "active" });
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("clears the cache and re-runs guards when a different user signs in", async () => {
    vi.spyOn(api, "login").mockResolvedValue({ user: otherUser, csrf_token: "token" });
    const { clearSpy } = renderDialog();

    await reauthenticate(otherUser.email);

    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(otherUser);
  });

  it("signs out to login with the current route remembered", async () => {
    const userEventApi = userEvent.setup();
    vi.spyOn(api, "logout").mockResolvedValue(undefined);
    renderDialog();

    await userEventApi.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/login",
        search: { redirect: "/" },
      });
    });
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("surfaces a rejected logout before going to login", async () => {
    const userEventApi = userEvent.setup();
    vi.spyOn(api, "logout").mockRejectedValue(new ApiError(403, "forbidden", "forbidden"));
    renderDialog();

    await userEventApi.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("Signed out on this device")).toBeVisible();
    expect(
      screen.getByText("The server didn't end the session, so it may still be active there."),
    ).toBeVisible();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login", search: { redirect: "/" } }));
  });

  it("disables sign out while the request is in flight", async () => {
    const userEventApi = userEvent.setup();
    const logout = vi.spyOn(api, "logout").mockReturnValue(new Promise(() => undefined));
    renderDialog();

    const signOut = screen.getByRole("button", { name: "Sign out" });
    await userEventApi.click(signOut);

    await waitFor(() => expect(signOut).toBeDisabled());
    await userEventApi.click(signOut);
    expect(logout).toHaveBeenCalledOnce();
  });
});
