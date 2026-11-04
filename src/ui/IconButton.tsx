import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "./cn";

const iconButtonStyles = cva(
  "inline-flex items-center justify-center rounded-md transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "text-muted hover:bg-surface-2 hover:text-text",
        secondary: "border border-border-strong bg-surface text-text hover:bg-surface-2",
      },
      size: {
        sm: "size-touch md:size-control-sm",
        md: "size-touch md:size-control-md",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonStyles> {
  label: string;
  icon: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  className,
  variant,
  size,
  label,
  icon,
  type = "button",
  ref,
  ...props
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonStyles({ variant, size }), className)}
      {...props}
    >
      {icon}
    </button>
  );
}
