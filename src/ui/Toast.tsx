import * as ToastPrimitive from "@radix-ui/react-toast";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { IconButton } from "./IconButton";
import { LayerPortal } from "./LayerPortal";

export type ToastTone = "success" | "info" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Announce assertively (critical alerts and errors that interrupt). */
  assertive?: boolean;
  key?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  tone: ToastTone;
  open: boolean;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => number;
  dismiss: (id?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DEDUPE_MS = 10_000;

const toneIcon = {
  success: CircleCheck,
  info: Info,
  error: CircleAlert,
} as const;

const toneText = {
  success: "text-success",
  info: "text-info",
  error: "text-danger",
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const seen = useRef(new Map<string, number>());
  const viewportRef = useRef<HTMLOListElement>(null);

  const dismiss = useCallback((id?: number) => {
    setItems((current) => (id === undefined ? [] : current.filter((item) => item.id !== id)));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const tone = options.tone ?? "info";
    const dedupeKey = `${tone}:${options.key ?? options.title}`;
    const now = Date.now();
    const previous = seen.current.get(dedupeKey);
    if (previous !== undefined && now - previous < DEDUPE_MS) {
      return -1;
    }
    seen.current.set(dedupeKey, now);

    const id = nextId.current;
    nextId.current += 1;
    setItems((current) => [...current, { ...options, id, tone, open: true }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        Radix stores the viewport pause flag on its provider and never clears it
        when the queue empties, so a manual close can pause every later toast.
        Remount that provider whenever the queue drains, without remounting the app.
      */}
      <ToastPrimitive.Provider key={items.length === 0 ? "idle" : "active"} swipeDirection="right">
        <LayerPortal layer="toast">
          {items.map((item) => {
            const Icon = toneIcon[item.tone];
            return (
              <ToastPrimitive.Root
                key={item.id}
                open={item.open}
                duration={item.tone === "error" ? Infinity : 4_000}
                type={item.tone === "error" || item.assertive ? "foreground" : "background"}
                onOpenChange={(open) => {
                  if (!open) {
                    // Radix parks focus on the viewport when a toast closes and then
                    // never resumes its pause, so every later toast would stay open.
                    const active = document.activeElement;
                    if (active instanceof HTMLElement && viewportRef.current?.contains(active)) {
                      active.blur();
                    }
                    dismiss(item.id);
                  }
                }}
                className="max-w-panel border-border bg-surface shadow-float data-[state=open]:animate-fade-in flex w-11/12 items-start gap-2 rounded-lg border p-3"
              >
                <Icon
                  aria-hidden="true"
                  className={cn("mt-0.5 size-4 shrink-0", toneText[item.tone])}
                  strokeWidth={1.5}
                />
                <div className="min-w-0 flex-1">
                  <ToastPrimitive.Title className="text-text text-sm font-medium">
                    {item.title}
                  </ToastPrimitive.Title>
                  {item.description ? (
                    <ToastPrimitive.Description className="text-muted text-xs">
                      {item.description}
                    </ToastPrimitive.Description>
                  ) : null}
                </div>
                {item.action ? (
                  <ToastPrimitive.Action
                    altText={item.action.label}
                    asChild
                    onClick={item.action.onClick}
                  >
                    <button
                      type="button"
                      className="h-touch text-accent-fg hover:bg-surface-2 focus-visible:outline-focus-ring md:h-control-sm shrink-0 rounded-md px-2 text-sm font-medium focus-visible:outline-2"
                    >
                      {item.action.label}
                    </button>
                  </ToastPrimitive.Action>
                ) : null}
                <ToastPrimitive.Close asChild>
                  <IconButton
                    label="Dismiss"
                    size="sm"
                    icon={<X aria-hidden="true" className="size-icon-sm" strokeWidth={1.5} />}
                  />
                </ToastPrimitive.Close>
              </ToastPrimitive.Root>
            );
          })}
          <ToastPrimitive.Viewport
            ref={viewportRef}
            className="max-w-panel fixed right-4 bottom-4 flex w-11/12 flex-col gap-2 outline-none"
          />
        </LayerPortal>
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

export { ToastPrimitive };
