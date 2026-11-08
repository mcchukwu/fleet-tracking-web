import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../../../ui/Toast";
import { AlertEvidenceSection } from "./AlertEvidenceSection";

describe("AlertEvidenceSection", () => {
  it("renders known keys and nested values as text", () => {
    render(
      <ToastProvider>
        <AlertEvidenceSection evidence={{ distance_m: 2091.58, nested: { a: 1 } }} />
      </ToastProvider>,
    );
    expect(screen.getByText("Distance m")).toBeVisible();
    expect(screen.getByText("2091.58 m")).toBeVisible();
    expect(screen.getByText('{"a":1}')).toBeVisible();
  });

  it("toggles raw JSON as text only", async () => {
    render(
      <ToastProvider>
        <AlertEvidenceSection evidence={{ geofence_id: "gf-1" }} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Raw JSON" }));
    expect(screen.getByText(/"geofence_id": "gf-1"/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Readable view" })).toBeVisible();
  });

  it("hides the toggle when there is no evidence", () => {
    render(
      <ToastProvider>
        <AlertEvidenceSection evidence={{}} />
      </ToastProvider>,
    );
    expect(screen.getByText("No evidence recorded.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Raw JSON" })).not.toBeInTheDocument();
  });
});
