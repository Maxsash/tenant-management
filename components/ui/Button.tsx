"use client";

import { forwardRef } from "react";
import type { ComponentProps, ReactNode } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

type Variant = "solid" | "outline" | "ghost" | "danger";
type Size = "md" | "lg";

type Props = Omit<ComponentProps<typeof motion.button>, "children"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  solid: "bg-accent text-white hover:bg-accent-strong",
  outline: "border border-border bg-surface text-foreground hover:bg-accent-soft",
  ghost: "text-foreground hover:bg-accent-soft",
  danger: "bg-danger text-white hover:brightness-95",
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
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
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
