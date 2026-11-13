import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition duration-100 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
        secondary: "border border-border-strong bg-surface text-text hover:bg-surface-2",
        ghost: "text-text hover:bg-surface-2",
        destructive: "border border-border-strong bg-surface text-danger hover:bg-alert-bg",
      },
      size: {
        sm: "h-touch px-3 text-xs md:h-control-sm",
        md: "h-touch px-3 text-base md:h-control-md",
        lg: "h-touch px-4 text-base md:h-control-lg",
        touch: "h-touch px-3 text-xs",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  loading?: boolean;
  leadingIcon?: ReactNode;
  /** Keeps the control focusable and visible, explains why it cannot act. */
  disabledReason?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  leadingIcon,
  disabledReason,
  children,
  disabled,
  type = "button",
  onClick,
  ref,
  ...props
}: ButtonProps) {
  const roleDisabled = Boolean(disabledReason) && !disabled && !loading;

  const button = (
    <button
      ref={ref}
      type={type}
      className={cn(
        buttonStyles({ variant, size }),
        roleDisabled ? "cursor-not-allowed opacity-60" : undefined,
        className,
      )}
      disabled={disabled || loading}
      aria-disabled={roleDisabled || undefined}
      aria-busy={loading || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (roleDisabled) return;
        onClick?.(event);
      }}
      {...props}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
    </button>
  );

  if (!roleDisabled) return button;
  return <Tooltip label={disabledReason ?? ""}>{button}</Tooltip>;
}
