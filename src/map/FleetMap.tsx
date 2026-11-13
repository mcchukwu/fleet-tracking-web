import { useEffect, useRef, useState } from "react";
import { ErrorState } from "../errors/ErrorState";
import { normalize } from "../errors/normalize";
import type { AppError } from "../errors/types";
import { useErrorStorm } from "../errors/global";
import { useTheme } from "../theme/theme-context";
import { LoadingBar } from "../ui/StatePanel";
import { cn } from "../ui/cn";
import { loadMapAdapter } from "./load";
import { readMapTokens } from "./tokens";
import type {
  Bounds,
  MapAdapter,
  MapGeofence,
  MapProvider,
  MapRoute,
  MapStyleId,
  MapVehicle,
} from "./types";

const EMPTY_VEHICLES: readonly MapVehicle[] = [];
const EMPTY_GEOFENCES: readonly MapGeofence[] = [];

export interface FleetMapProps {
  adapter?: MapAdapter;
  provider?: MapProvider;
  variant?: "full" | "static";
  /** Accessible name; the alert detail uses "Alert position". */
  label?: string;
  vehicles?: readonly MapVehicle[];
  geofences?: readonly MapGeofence[];
  route?: MapRoute | null;
  bounds?: Bounds;
  baseStyle?: MapStyleId;
  dimmed?: boolean;
  className?: string;
  onReady?: (adapter: MapAdapter) => void;
  onError?: (error: AppError) => void;
}

export function FleetMap({
  adapter,
  provider,
  variant = "full",
  label = "Live map",
  vehicles = EMPTY_VEHICLES,
  geofences = EMPTY_GEOFENCES,
  route = null,
  bounds,
  baseStyle,
  dimmed = false,
  className,
  onReady,
  onError,
}: FleetMapProps) {
  const theme = useTheme();
  const storm = useErrorStorm();
  const canvasRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef(theme.resolved);
  const boundsRef = useRef(bounds);
  const baseStyleRef = useRef(baseStyle);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    themeRef.current = theme.resolved;
    boundsRef.current = bounds;
    baseStyleRef.current = baseStyle;
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });

  const [loadedAdapter, setLoadedAdapter] = useState<MapAdapter | null>(null);
  const [resolveError, setResolveError] = useState<AppError | null>(null);
  const [mountError, setMountError] = useState<AppError | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const activeAdapter = adapter ?? loadedAdapter;

  useEffect(() => {
    if (adapter) return;

    let cancelled = false;
    void loadMapAdapter(provider)
      .then((next) => {
        if (!cancelled) setLoadedAdapter(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          const error = normalize(cause, { action: "load the map" });
          setResolveError(error);
          onErrorRef.current?.(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adapter, provider, attempt]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!activeAdapter || !element) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const instance = activeAdapter;
    const target = element;

    async function mount(): Promise<void> {
      try {
        await instance.mount(target, {
          theme: themeRef.current,
          tokens: readMapTokens(target),
          ...(boundsRef.current ? { bounds: boundsRef.current } : {}),
          ...(baseStyleRef.current ? { baseStyle: baseStyleRef.current } : {}),
        });
        if (cancelled) return;
        if (variant === "static") {
          // The mini map is decorative; its provider canvas must not join the
          // tab order inside the aria-hidden frame.
          for (const canvas of target.querySelectorAll("canvas")) canvas.tabIndex = -1;
        }

        setLoaded(true);
        const offReady = instance.on("ready", () => setLoaded(true));
        const offError = instance.on("error", (error) => {
          setMountError(error);
          onErrorRef.current?.(error);
        });
        cleanup = () => {
          offReady();
          offError();
          instance.destroy();
        };
        onReadyRef.current?.(instance);
      } catch (cause) {
        if (cancelled) return;
        const error = normalize(cause, { action: "load the map" });
        setMountError(error);
        onErrorRef.current?.(error);
      }
    }

    void mount();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
      else instance.destroy();
    };
  }, [activeAdapter, attempt]);

  useEffect(() => {
    if (loaded && activeAdapter) {
      activeAdapter.setTheme(theme.resolved, readMapTokens());
    }
  }, [theme.resolved, theme.accent, loaded, activeAdapter]);

  useEffect(() => {
    if (loaded && activeAdapter) activeAdapter.setVehicles(vehicles);
  }, [vehicles, loaded, activeAdapter]);

  useEffect(() => {
    if (loaded && activeAdapter) activeAdapter.setGeofences(geofences);
  }, [geofences, loaded, activeAdapter]);

  useEffect(() => {
    if (loaded && activeAdapter) activeAdapter.setRoute(route);
  }, [route, loaded, activeAdapter]);

  useEffect(() => {
    if (loaded && activeAdapter && baseStyle) activeAdapter.setBaseStyle(baseStyle);
  }, [baseStyle, loaded, activeAdapter]);

  const error = resolveError ?? mountError;

  function retry() {
    if (!adapter) setLoadedAdapter(null);
    setResolveError(null);
    setMountError(null);
    setLoaded(false);
    setAttempt((value) => value + 1);
  }

  return (
    <section
      aria-label={label}
      aria-busy={!loaded && !error ? true : undefined}
      className={cn(
        "bg-surface-2 relative overflow-hidden",
        variant === "full" ? "h-full min-h-48 w-full" : "h-48 w-full",
        dimmed && "opacity-60",
        className,
      )}
    >
      <div className="absolute inset-0">
        <div
          ref={canvasRef}
          data-testid="fleet-map-canvas"
          aria-hidden={variant === "static" ? true : undefined}
          className="h-full w-full"
        />
      </div>
      {!loaded && !error ? (
        <div className="z-map-controls bg-surface absolute inset-x-0 top-0">
          <LoadingBar label="Loading map" />
        </div>
      ) : null}
      {error ? (
        <div className="bg-surface absolute inset-0 flex items-center justify-center">
          <ErrorState error={error} onRetry={retry} compact={storm} />
        </div>
      ) : null}
    </section>
  );
}
