"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, Users } from "lucide-react";
import { cn } from "@/utils/cn";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tenant", label: "Tenants", icon: Users },
  { href: "/expense", label: "Expenses", icon: Receipt },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-8 md:flex">
      <p className="px-2 font-display text-2xl italic text-accent">Shrivastava Hub</p>

      <nav className="mt-10 flex flex-col gap-1">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-muted hover:bg-accent-soft/60 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
