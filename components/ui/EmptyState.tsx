import type { ReactNode } from "react";
import { Waves, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  action?: ReactNode;
};

/** Nothing here yet: calm water on an empty chart. */
export default function EmptyState({ icon: Icon = Waves, title, description, className, action }: Props) {
  return (
    <div
      className={cn(
        "graph-paper flex flex-col items-center gap-2 rounded-2xl border border-dashed border-accent/35 bg-surface/60 px-6 py-10 text-center",
        className
      )}
    >
      <div className="porthole mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="font-display text-lg font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-xs text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}
