import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./IconButton";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  headerAside?: ReactNode;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, headerAside, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    /* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click closes the modal dialog; Escape is handled by onCancel. */
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className="m-0 ml-auto h-full max-h-none w-drawer max-w-full animate-slide-in border-l border-border bg-surface p-0 text-text shadow-float open:flex open:flex-col"
    >
      <div className="flex h-topbar shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={titleId} className="truncate font-mono text-md font-medium text-text">
            {title}
          </h2>
          {headerAside}
        </div>
        <IconButton label="Close drawer" icon={<X aria-hidden="true" className="size-4" strokeWidth={1.5} />} onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </dialog>
  );
}
