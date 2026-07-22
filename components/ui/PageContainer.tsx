import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** md: forms/detail screens. lg: list/dashboard screens that benefit from a wider column. */
  size?: "md" | "lg";
};

const sizeClasses: Record<string, string> = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
};

export default function PageContainer({ size = "md", className, ...props }: Props) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-8 px-5 pt-8 pb-28 sm:px-8 sm:pt-10 md:pb-12",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
