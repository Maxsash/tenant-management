"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/utils/cn";
import type { ExpenseCategory, ExpenseItem } from "@/types/expense";

type Props = {
  categories: ExpenseCategory[];
  items: ExpenseItem[];
  onPick: (item: ExpenseItem) => void;
};

export default function ItemPicker({ categories, items, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !categoryFilter) return [];

    return items.filter((item) => {
      const matchesQuery = !q || item.name.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [items, query, categoryFilter]);

  const browsing = query.trim().length > 0 || categoryFilter !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          aria-label="Search items"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted"
        />
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
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
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              categoryFilter === c.name
                ? "border-accent bg-accent text-white"
                : "border-border bg-surface text-foreground"
            )}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {browsing ? (
        results.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent-soft"
              >
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted">{item.category}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 py-6 text-center text-sm text-muted">
            No items match — try a different search, or use Other / Lump Sum instead.
          </p>
        )
      ) : (
        <p className="px-1 py-6 text-center text-sm text-muted">
          Search by name, or pick a category to browse.
        </p>
      )}
    </div>
  );
}
