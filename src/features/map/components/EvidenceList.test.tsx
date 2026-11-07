import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../../../ui/Toast";
import { EvidenceList } from "./EvidenceList";

describe("EvidenceList", () => {
  it("renders nested values as text, never HTML", () => {
    render(
      <ToastProvider>
        <EvidenceList
          evidence={{
            distance_m: 2091.58,
            geofence_id: "00000000-0000-0000-0000-000000000202",
            nested: { a: 1 },
            enabled: true,
            note: "<b>not html</b>",
          }}
        />
      </ToastProvider>,
    );

    expect(screen.getByText("2091.58 m")).toBeVisible();
    expect(screen.getByText('{"a":1}')).toBeVisible();
    expect(screen.getByText("Yes")).toBeVisible();
    expect(screen.getByText("<b>not html</b>")).toBeVisible();
    expect(screen.queryByRole("strong")).not.toBeInTheDocument();
  });

  it("copies a UUID-like value and reports empty evidence", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ToastProvider>
        <EvidenceList evidence={{ geofence_id: "00000000-0000-0000-0000-000000000202" }} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /copy geofence id/i }));
    expect(await screen.findByText("Geofence id copied")).toBeVisible();

    rerender(
      <ToastProvider>
        <EvidenceList evidence={{}} />
      </ToastProvider>,
    );
    expect(screen.getByText("No evidence recorded.")).toBeVisible();
  });
});
