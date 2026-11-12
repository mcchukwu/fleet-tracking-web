import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeforeInstallPromptEvent } from "./types";
import {
  captureInstallPrompt,
  promptInstall,
  requestPersistentStorage,
  resetInstallPromptForTests,
  subscribeInstall,
} from "./install";

class FakeInstallEvent extends Event implements BeforeInstallPromptEvent {
  readonly platforms = ["web"];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  readonly prompt = vi.fn().mockResolvedValue(undefined);

  constructor(outcome: "accepted" | "dismissed" = "accepted") {
    super("beforeinstallprompt", { cancelable: true });
    this.userChoice = Promise.resolve({ outcome, platform: "web" });
  }
}

beforeEach(() => {
  resetInstallPromptForTests();
  captureInstallPrompt();
});

afterEach(() => {
  resetInstallPromptForTests();
  vi.restoreAllMocks();
});

describe("install prompt", () => {
  it("captures beforeinstallprompt without showing a modal", async () => {
    const event = new FakeInstallEvent();
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await expect(promptInstall()).resolves.toBe("accepted");
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("becomes unavailable after the prompt is used", async () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeInstall(() => states.push(true));
    window.dispatchEvent(new FakeInstallEvent("dismissed"));

    await expect(promptInstall()).resolves.toBe("dismissed");
    expect(await promptInstall()).toBe("unavailable");
    expect(states.length).toBeGreaterThanOrEqual(2);
    unsubscribe();
  });

  it("hides the action once the app is installed", async () => {
    window.dispatchEvent(new FakeInstallEvent());
    window.dispatchEvent(new Event("appinstalled"));
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("ignores a persistent-storage denial or failure", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persist: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it("requests persistent storage after the user accepts", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persist },
    });

    window.dispatchEvent(new FakeInstallEvent("accepted"));
    await promptInstall();

    expect(persist).toHaveBeenCalledTimes(1);
  });
});
