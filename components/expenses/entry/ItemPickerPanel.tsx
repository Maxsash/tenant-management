"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, PlusCircle, Search } from "lucide-react";

import { groupItemsByCategory } from "@/lib/expense-categories";
import { cn } from "@/utils/cn";
import type { ExpenseCategory, ExpenseItem } from "@/types/expense";

type Props = {
  categories: ExpenseCategory[];
  items: ExpenseItem[];
  /** Most-bought items, computed server-side. Empty for a new household. */
  suggested: ExpenseItem[];
  onPick: (item: ExpenseItem) => void;
  /** Escape hatch: log something the catalogue has never heard of. */
  onPickCustom: (name: string, category: string) => void;
  onClose: () => void;
};

/**
 * Picking what an expense was for.
 *
 * Slides over the entry sheet rather than sitting inside it, so choosing an
 * item never pushes the amount field off-screen — the scrolling-back-and-forth
 * this whole entry flow was rebuilt to get rid of.
 *
 * It also refuses to open empty: with no search typed it shows what this
 * household actually buys, which is the answer for a picker that used to say
 * "search by name" to someone who does not know what the catalogue calls the
 * thing in their hand.
 */
export default function ItemPickerPanel({
  categories,
  items,
  suggested,
  onPick,
  onPickCustom,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const trimmedQuery = query.trim();

  const results = useMemo(() => {
    const q = trimmedQuery.toLowerCase();

    return items.filter((item) => {
      const matchesQuery = !q || item.name.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || item.category === categoryFilter;

      return matchesQuery && matchesCategory;
    });
  }, [items, trimmedQuery, categoryFilter]);

  const browsing = trimmedQuery.length > 0 || categoryFilter !== null;
  const grouped = useMemo(
    () => groupItemsByCategory(categories, results),
    [categories, results]
  );

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      className="absolute inset-0 z-10 flex flex-col bg-surface"
      role="dialog"
      aria-label="Choose an item"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="rounded-full p-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex h-12 flex-1 items-center gap-2.5 rounded-xl border border-border bg-background px-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={searchRef}
            aria-label="Search items"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted"
          />
        </div>
      </header>

      <div className="-mb-px flex shrink-0 gap-2 overflow-x-auto border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            categoryFilter === null
              ? "border-accent bg-accent text-white"
              : "border-border bg-surface text-foreground"
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === c.name ? null : c.name)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              categoryFilter === c.name
                ? "border-accent bg-accent text-white"
                : "border-border bg-surface text-foreground"
            )}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!browsing && suggested.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Often bought
            </h3>
            <div className="flex flex-col gap-1.5">
              {suggested.map((item) => (
                <ItemButton key={item.id} item={item} onPick={onPick} />
              ))}
            </div>
          </section>
        )}

        {browsing && results.length === 0 ? (
          <div className="px-1 py-8 text-center">
            <p className="text-sm text-muted">
              Nothing in the catalogue matches that.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {!browsing && suggested.length > 0 && (
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                Everything else
              </h3>
            )}
            {grouped.map((group) => (
              <section key={group.category}>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {group.icon} {group.category}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((item) => (
                    <ItemButton key={item.id} item={item} onPick={onPick} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {trimmedQuery.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onPickCustom(
                trimmedQuery,
                categoryFilter ?? categories[0]?.name ?? "Other"
              )
            }
            className="mt-5 flex w-full items-center gap-3 rounded-xl border border-dashed border-accent bg-accent-soft px-4 py-3.5 text-left transition-colors hover:bg-accent-soft/70"
          >
            <PlusCircle className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">
                Log “{trimmedQuery}” anyway
              </span>
              <span className="block text-xs text-muted">
                Just this once, without adding it to the catalogue
              </span>
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ItemButton({
  item,
  onPick,
}: {
  item: ExpenseItem;
  onPick: (item: ExpenseItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent-soft"
    >
      <span className="min-w-0 truncate font-medium text-foreground">{item.name}</span>
      {item.default_unit && (
        <span className="shrink-0 text-xs text-muted">{item.default_unit}</span>
      )}
    </button>
  );
}
