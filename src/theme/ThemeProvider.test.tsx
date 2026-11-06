import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./theme-context";

function Probe() {
  const theme = useTheme();
  return (
    <>
      <span data-testid="accent">{theme.accent}</span>
      <span data-testid="mode">{theme.mode}</span>
      <button type="button" onClick={() => theme.setMode("dark")}>
        Use dark
      </button>
      <button type="button" onClick={() => theme.setAccent("fuchsia")}>
        Use fuchsia
      </button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.accent;
});

describe("ThemeProvider", () => {
  it("applies the theme class before child passive effects read it", async () => {
    const observed: Array<string | undefined> = [];

    function Observer() {
      const theme = useTheme();
      useEffect(() => {
        observed.push(document.documentElement.dataset.theme);
      });
      return (
        <button type="button" onClick={() => theme.setMode("dark")}>
          Use dark
        </button>
      );
    }

    render(
      <ThemeProvider>
        <Observer />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Use dark" }));
    expect(observed.at(-1)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("restores the stored theme and accent", () => {
    localStorage.setItem("fleet.theme", "dark");
    localStorage.setItem("fleet.accent", "violet");

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("dark");
    expect(screen.getByTestId("accent")).toHaveTextContent("violet");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.accent).toBe("violet");
  });

  it("persists theme and accent changes", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Use dark" }));
    await userEvent.click(screen.getByRole("button", { name: "Use fuchsia" }));

    expect(localStorage.getItem("fleet.theme")).toBe("dark");
    expect(localStorage.getItem("fleet.accent")).toBe("fuchsia");
    expect(document.documentElement.dataset.accent).toBe("fuchsia");
  });

  it("falls back to blue when an unknown accent is stored", () => {
    localStorage.setItem("fleet.accent", "teal");

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("accent")).toHaveTextContent("blue");
    expect(document.documentElement.dataset.accent).toBe("blue");
  });
});
