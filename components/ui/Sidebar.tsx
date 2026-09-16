"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, Users } from "lucide-react";
import { cn } from "@/utils/cn";
import Mark from "./sea/Mark";
import SeaScene from "./sea/SeaScene";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tenant", label: "Tenants", icon: Users },
  { href: "/expense", label: "Expenses", icon: Receipt },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-surface/70 backdrop-blur-sm md:flex">
      <div className="flex items-center gap-3 px-5 pt-8">
        <Mark className="h-11 w-11 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted uppercase">
            Maxsash Studio
          </p>
          <p className="font-display text-[22px] leading-tight text-accent italic">Shrivastava Hub</p>
        </div>
      </div>

      <nav className="mt-10 flex flex-col gap-1.5 px-4">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors",
                active
                  ? "bg-accent bg-linear-to-b from-accent-bright to-accent text-on-accent shadow-[0_8px_18px_-10px_var(--shadow-tint-strong)]"
                  : "text-muted hover:bg-accent-soft hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* The harbour, moored at the foot of the sidebar. */}
      <SeaScene sky={false} shore="var(--color-sand)" className="mt-auto h-56 shrink-0" />
    </aside>
  );
}
