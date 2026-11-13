import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("size-icon-sm animate-spin", className)}
      strokeWidth={1.5}
    />
  );
}
