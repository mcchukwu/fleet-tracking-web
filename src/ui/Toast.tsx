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

export type ToastTone = "success" | "info" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
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

  const dismiss = useCallback((id?: number) => {
    setItems((current) =>
      id === undefined ? [] : current.filter((item) => item.id !== id),
    );
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
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((item) => {
          const Icon = toneIcon[item.tone];
          return (
            <ToastPrimitive.Root
              key={item.id}
              open={item.open}
              duration={item.tone === "error" ? Infinity : 4_000}
              type={item.tone === "error" ? "foreground" : "background"}
              onOpenChange={(open) => {
                if (!open) dismiss(item.id);
              }}
              className="flex w-11/12 max-w-panel items-start gap-2 rounded-lg border border-border bg-surface p-3 shadow-float data-[state=open]:animate-fade-in"
            >
              <Icon
                aria-hidden="true"
                className={cn("mt-0.5 size-4 shrink-0", toneText[item.tone])}
                strokeWidth={1.5}
              />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-sm font-medium text-text">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="text-xs text-muted">
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
                    className="h-control-sm shrink-0 rounded-md px-2 text-sm font-medium text-accent-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus-ring"
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
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-toast flex w-11/12 max-w-panel flex-col gap-2 outline-none" />
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
