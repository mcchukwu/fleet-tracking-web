import type { Padding } from "../../../map/types";
import { DRAWER_WIDTH, PANEL_INSET, PANEL_WIDTH, SHEET_PEEK } from "./constants";
import type { SheetSnap } from "./sheet";

export type { SheetSnap } from "./sheet";

export interface FitPaddingInput {
  isDesktop: boolean;
  panelOpen: boolean;
  sheetSnap: SheetSnap;
  drawerOpen?: boolean;
  drawerWidth?: number;
}

export function fitPadding({
  isDesktop,
  panelOpen,
  sheetSnap,
  drawerOpen = false,
  drawerWidth = DRAWER_WIDTH,
}: FitPaddingInput): Padding {
  if (isDesktop) {
    return {
      top: 96,
      right: drawerOpen ? drawerWidth + PANEL_INSET * 2 : PANEL_INSET,
      bottom: PANEL_INSET,
      left: panelOpen ? PANEL_WIDTH + PANEL_INSET * 2 : PANEL_INSET,
    };
  }

  const bottom = sheetSnap === "full" ? 420 : sheetSnap === "half" ? 300 : SHEET_PEEK + 12;
  return { top: 104, right: 12, bottom, left: 12 };
}
