"use client";

import { forwardRef } from "react";
import type { ComponentProps, ReactNode } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

type Variant = "solid" | "outline" | "ghost" | "danger" | "warning";
type Size = "md" | "lg";

type Props = Omit<ComponentProps<typeof motion.button>, "children"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  // Sunlit at the top, like the sea on the Hub.
  solid:
    "bg-accent bg-linear-to-b from-accent-bright to-accent text-on-accent shadow-[0_10px_20px_-12px_var(--shadow-tint-strong)] hover:from-accent hover:to-accent-strong",
  outline:
    "border border-border bg-surface text-foreground hover:border-accent/40 hover:bg-accent-soft",
  ghost: "text-foreground hover:bg-accent-soft",
  danger: "bg-danger text-on-danger hover:brightness-95",
  warning: "bg-warning text-on-warning hover:brightness-95",
};

const sizeClasses: Record<Size, string> = {
  md: "h-12 px-5 text-[15px]",
  lg: "h-14 px-6 text-base",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "solid", size = "md", loading, disabled, className, children, ...props },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
});

export default Button;
