import type { Padding } from "../../../map/types";
import { PANEL_INSET, PANEL_WIDTH, SHEET_PEEK } from "./constants";

export type SheetSnap = "peek" | "half" | "full";

export interface FitPaddingInput {
  isDesktop: boolean;
  panelOpen: boolean;
  sheetSnap: SheetSnap;
}

export function fitPadding({ isDesktop, panelOpen, sheetSnap }: FitPaddingInput): Padding {
  if (isDesktop) {
    return {
      top: 96,
      right: PANEL_INSET,
      bottom: PANEL_INSET,
      left: panelOpen ? PANEL_WIDTH + PANEL_INSET * 2 : PANEL_INSET,
    };
  }

  const bottom = sheetSnap === "full" ? 420 : sheetSnap === "half" ? 300 : SHEET_PEEK + 12;
  return { top: 104, right: 12, bottom, left: 12 };
}
