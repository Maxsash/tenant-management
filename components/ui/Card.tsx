import type { HTMLAttributes, KeyboardEvent, MouseEvent } from "react";
import { cn } from "@/utils/cn";

export default function Card({ className, onClick, ...props }: HTMLAttributes<HTMLDivElement>) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (e.key !== "Enter" && e.key !== " ") return;

    e.preventDefault();
    onClick(e as unknown as MouseEvent<HTMLDivElement>);
  }

  return (
    <div
      className={cn("rounded-xl border border-border bg-surface shadow-card", className)}
      {...props}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
    />
  );
}
