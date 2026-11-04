import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/instance";
import { ApiError } from "../../errors/types";
import { normalize } from "../../errors/normalize";
import { useConnectionStore } from "../../stores/connection";
import { LoginForm } from "./components/LoginForm";

function renderForm() {
  const queryClient = new QueryClient();
  const onSuccess = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <LoginForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess };
}

function credentials() {
  return {
    email: screen.getByLabelText("Email"),
    password: screen.getByLabelText("Password"),
    submit: screen.getByRole("button", { name: "Sign in" }),
  };
}

beforeEach(() => {
  useConnectionStore.getState().setNetwork("online");
});

afterEach(() => {
  vi.useRealTimers();
  useConnectionStore.getState().setNetwork("online");
});

describe("LoginForm", () => {
  it("validates empty fields before calling the API", async () => {
    const user = userEvent.setup();
    const login = vi.spyOn(api, "login");
    renderForm();

    await user.click(credentials().submit);

    expect(await screen.findByText("Enter a valid email address.")).toBeVisible();
    expect(screen.getByText("Enter your password.")).toBeVisible();
    expect(login).not.toHaveBeenCalled();
  });

  it("keeps the email, clears the password and focuses the error after a 401", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "login").mockRejectedValue(
      normalize(new ApiError(401, "invalid_credentials", "invalid email or password")),
    );
    const { onSuccess } = renderForm();

    await user.type(credentials().email, "dispatcher@demo.ftb");
    await user.type(credentials().password, "wrong-password");
    await user.click(credentials().submit);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Email or password is incorrect.");
    expect(alert).not.toHaveTextContent("session expired");
    expect(credentials().email).toHaveValue("dispatcher@demo.ftb");
    expect(credentials().password).toHaveValue("");
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("disables submit during a rate limit and counts down", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "login").mockRejectedValue(
      normalize(new ApiError(429, "rate_limited", "Too many attempts", 3)),
    );
    renderForm();

    await user.type(credentials().email, "dispatcher@demo.ftb");
    await user.type(credentials().password, "wrong-password");
    await user.click(credentials().submit);

    expect(await screen.findByText(/Try again in \d+s\./)).toBeVisible();
    expect(credentials().submit).toBeDisabled();
  });

  it("keeps both fields after a network failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "login").mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm();

    await user.type(credentials().email, "dispatcher@demo.ftb");
    await user.type(credentials().password, "secret");
    await user.click(credentials().submit);

    expect(await screen.findByText("Can't reach the server")).toBeVisible();
    expect(credentials().email).toHaveValue("dispatcher@demo.ftb");
    expect(credentials().password).toHaveValue("secret");
  });

  it("disables submit with a reason while offline", () => {
    useConnectionStore.getState().setNetwork("offline");
    renderForm();

    expect(credentials().submit).toBeDisabled();
    expect(screen.getByText("You're offline. Reconnect to sign in.")).toBeVisible();
  });

  it("toggles password visibility without submitting or losing focus", async () => {
    const user = userEvent.setup();
    const login = vi.spyOn(api, "login");
    renderForm();

    await user.type(credentials().password, "secret");
    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);

    expect(credentials().password).toHaveAttribute("type", "text");
    expect(toggle).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows the slow states for a request that never settles", async () => {
    vi.useFakeTimers();
    vi.spyOn(api, "login").mockImplementation(() => new Promise(() => undefined));
    renderForm();

    fireEvent.change(credentials().email, { target: { value: "dispatcher@demo.ftb" } });
    fireEvent.change(credentials().password, { target: { value: "secret" } });
    await act(async () => {
      fireEvent.click(credentials().submit);
    });

    await act(async () => { vi.advanceTimersByTime(3_100); });
    expect(screen.getByText("Still working…")).toBeVisible();

    await act(async () => { vi.advanceTimersByTime(7_000); });
    expect(screen.getByText("Taking longer than usual")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
