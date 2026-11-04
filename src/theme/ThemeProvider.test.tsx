import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./theme-context";

describe("ThemeProvider", () => {
  it("applies the theme class before child passive effects read it", async () => {
    const observed: Array<string | undefined> = [];

    function Probe() {
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
        <Probe />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Use dark" }));
    expect(observed.at(-1)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
