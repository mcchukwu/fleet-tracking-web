import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToastProvider } from "../../../ui/Toast";
import { resetStorageNoticeForTests, StorageNotice } from "./StorageNotice";

function renderNotice() {
  render(
    <ToastProvider>
      <StorageNotice />
    </ToastProvider>,
  );
}

function announce(): void {
  act(() => {
    window.dispatchEvent(new CustomEvent("fleet:storage-unavailable"));
  });
}

afterEach(() => {
  resetStorageNoticeForTests();
});

describe("StorageNotice", () => {
  it("shows the storage copy once when the notice arrives after mount", () => {
    renderNotice();
    announce();

    expect(screen.getByText("Offline storage isn't available")).toBeVisible();

    announce();
    expect(screen.getAllByText("Offline storage isn't available")).toHaveLength(1);
  });

  it("replays a notice that arrived before mount", () => {
    announce();
    renderNotice();
    expect(screen.getByText("Offline storage isn't available")).toBeVisible();
  });

  it("never shows more than one toast per session", () => {
    renderNotice();
    announce();
    announce();
    announce();
    expect(screen.getAllByText("Offline storage isn't available")).toHaveLength(1);
  });
});
