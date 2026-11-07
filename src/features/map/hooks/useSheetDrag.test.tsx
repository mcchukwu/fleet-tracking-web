import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CSSProperties } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSheetDrag } from "./useSheetDrag";
import type { SheetSnap } from "../lib/sheet";

function Harness({
  snap,
  onSnap,
  onObscuredChange,
}: {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  onObscuredChange?: (obscured: boolean) => void;
}) {
  const { sheetRef, visible, handlers } = useSheetDrag({
    snap,
    onSnap,
    ...(onObscuredChange ? { onObscuredChange } : {}),
  });
  return (
    <div style={{ height: 800 }}>
      <section
        ref={sheetRef}
        data-testid="sheet"
        style={{ "--sheet-visible": `${visible}px` } as CSSProperties}
      >
        <div data-testid="header" {...handlers}>
          <button type="button" data-sheet-action>
            Action
          </button>
        </div>
      </section>
    </div>
  );
}

describe("useSheetDrag", () => {
  it("starts at the snap height and publishes per pointer move", async () => {
    render(<Harness snap="half" onSnap={vi.fn()} />);
    const sheet = screen.getByTestId("sheet");
    const header = screen.getByTestId("header");
    expect(sheet.style.getPropertyValue("--sheet-visible")).toBe("320px");

    fireEvent.pointerDown(header, { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(header, { clientY: 450, pointerId: 1 });
    await waitFor(() => expect(sheet.style.getPropertyValue("--sheet-visible")).toBe("370px"));
  });

  it("snaps to the nearest snap on release and reports the snap", () => {
    const onSnap = vi.fn();
    render(<Harness snap="half" onSnap={onSnap} />);
    const header = screen.getByTestId("header");

    fireEvent.pointerDown(header, { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(header, { clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(header, { clientY: 150, pointerId: 1 });

    expect(onSnap).toHaveBeenCalledWith("full");
  });

  it("reports obscuring above 60% and removes the drag flag", () => {
    const onObscuredChange = vi.fn();
    render(<Harness snap="half" onSnap={vi.fn()} onObscuredChange={onObscuredChange} />);
    const header = screen.getByTestId("header");

    fireEvent.pointerDown(header, { clientY: 700, pointerId: 1 });
    fireEvent.pointerMove(header, { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(header, { clientY: 200, pointerId: 1 });

    expect(onObscuredChange).toHaveBeenCalledWith(true);
  });

  it("clears the obscured state when the sheet unmounts", () => {
    const onObscuredChange = vi.fn();
    const { unmount } = render(
      <Harness snap="half" onSnap={vi.fn()} onObscuredChange={onObscuredChange} />,
    );
    const header = screen.getByTestId("header");

    fireEvent.pointerDown(header, { clientY: 700, pointerId: 1 });
    fireEvent.pointerMove(header, { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(header, { clientY: 200, pointerId: 1 });
    expect(onObscuredChange).toHaveBeenLastCalledWith(true);

    unmount();
    expect(onObscuredChange).toHaveBeenLastCalledWith(false);
  });

  it("does not drag from a sheet action", () => {
    render(<Harness snap="half" onSnap={vi.fn()} />);
    const sheet = screen.getByTestId("sheet");
    const action = screen.getByRole("button", { name: "Action" });

    fireEvent.pointerDown(action, { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(action, { clientY: 100, pointerId: 1 });

    expect(sheet.style.getPropertyValue("--sheet-visible")).toBe("320px");
  });
});
