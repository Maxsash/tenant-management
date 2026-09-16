import type { ReactNode } from "react";
import { Waves } from "lucide-react";

import { cn } from "@/utils/cn";

type Props = {
  /** A small nautical line above the title. Decoration, so keep the title
   *  itself plain — it is what people actually read. */
  eyebrow: string;
  title: string;
  /** Sits before the title, e.g. a back link. */
  leading?: ReactNode;
  /** Sits beside the title on wide screens and under it on a phone. */
  children?: ReactNode;
  className?: string;
};

export default function PageHeader({ eyebrow, title, leading, children, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {leading}
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
            <Waves className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 className="mt-1.5 font-display text-[34px] leading-none font-semibold text-foreground">
            {title}
          </h1>
          <div aria-hidden="true" className="squiggle mt-2.5 w-20 text-accent/70" />
        </div>
      </div>
      {children}
    </div>
  );
}
