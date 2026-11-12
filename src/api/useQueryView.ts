import { useConnection } from "../stores/connection";

export type QueryViewState = "loading" | "offline-empty" | "error" | "empty" | "ready";

/** The subset of a query result the view needs; mutations are not accepted. */
export interface QueryViewSource<TData> {
  data: TData | undefined;
  error: unknown;
  isLoading: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}

export interface QueryViewOptions<TData> {
  /** Override the connection store when the component already receives it. */
  offline?: boolean;
  /** Defaults to undefined data and empty arrays. */
  isEmpty?: (data: TData) => boolean;
}

export interface QueryView<TData> {
  state: QueryViewState;
  data: TData | undefined;
  error: unknown;
  isLoading: boolean;
  isOfflineEmpty: boolean;
  isEmpty: boolean;
  isError: boolean;
}

function defaultIsEmpty(data: unknown): boolean {
  if (data === undefined) return true;
  return Array.isArray(data) && data.length === 0;
}

/**
 * One answer for "what should this panel render". A query paused by the online
 * network mode has `isLoading: false` and `fetchStatus: "paused"`; that is the
 * neutral offline state, never a skeleton.
 */
export function useQueryView<TData>(
  query: QueryViewSource<TData>,
  options: QueryViewOptions<TData> = {},
): QueryView<TData> {
  const { network } = useConnection();
  const offline = options.offline ?? network === "offline";
  const hasData = query.data !== undefined;
  const isLoading = query.isLoading;
  const isPaused = query.fetchStatus === "paused";
  const isOfflineEmpty = !hasData && !isLoading && (offline || isPaused);
  const isError = !offline && !hasData && !isLoading && query.error != null;
  const isEmpty = hasData && (options.isEmpty?.(query.data as TData) ?? defaultIsEmpty(query.data));

  const state: QueryViewState = isLoading
    ? "loading"
    : isOfflineEmpty
      ? "offline-empty"
      : isError
        ? "error"
        : isEmpty
          ? "empty"
          : "ready";

  return {
    state,
    data: query.data,
    error: query.error,
    isLoading,
    isOfflineEmpty,
    isEmpty,
    isError,
  };
}
