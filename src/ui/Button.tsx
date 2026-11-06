import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

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
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  loading?: boolean;
  leadingIcon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  leadingIcon,
  children,
  disabled,
  type = "button",
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
    </button>
  );
}
