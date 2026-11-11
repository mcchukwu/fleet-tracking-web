import type { Padding } from "../../../map/types";

/** One row height for the list, its skeleton and the virtualized measurements. */
export const GEOFENCE_ROW_HEIGHT = 48;

/** The list panel is a fixed 360px at `lg` and above. */
export const GEOFENCE_PANEL_WIDTH = 360;

/** The toolbar under the search field owns a fixed line so selection never shifts the list. */
export const GEOFENCE_TOOLBAR_HEIGHT = 44;

/** Keep the polygon clear of the map controls on the right and the hint on top. */
export const FIT_PADDING_DESKTOP: Padding = { top: 48, right: 64, bottom: 48, left: 48 };
export const FIT_PADDING_MOBILE: Padding = { top: 48, right: 64, bottom: 48, left: 24 };

export const GEOFENCE_FIT_MAX_ZOOM = 12;
