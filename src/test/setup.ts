import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetMockState } from "../mocks/handlers";
import { server } from "../mocks/server";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockState();
  localStorage.removeItem("fleet.mockSession"); // guard-ignore: test-only mock session reset.
  localStorage.removeItem("fleet.mockRole"); // guard-ignore: test-only mock session reset.
  localStorage.removeItem("fleet.mockAuth"); // guard-ignore: test-only mock session reset.
});

afterAll(() => {
  server.close();
});
