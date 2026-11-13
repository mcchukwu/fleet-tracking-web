import { LoadingBar } from "../ui/StatePanel";

/** The only route-loading surface: a 2px indeterminate bar inside the shell. */
export function RouteLoading() {
  return (
    <div data-route-loading className="px-4 pt-3 sm:px-6">
      <LoadingBar label="Loading page" />
    </div>
  );
}
