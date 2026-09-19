"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import Card from "@/components/ui/Card";
import { getCategoryIcon } from "@/lib/expense-categories";
import type { ExpenseCategory, LastingGroup } from "@/types/expense";
import { cn } from "@/utils/cn";
import { lastingDetail } from "./rhythm-copy";

/** Rows a category shows before "Show all". Enough for the regulars, few
 *  enough that the categories below are a short scroll away. */
const VISIBLE_ROWS = 5;

type Props = {
  groups: LastingGroup[];
  categories: ExpenseCategory[];
  onSelect: (key: string) => void;
};

function groupId(category: string) {
  return `lasting-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default function LastingGroups({ groups, categories, onSelect }: Props) {
  function jumpTo(category: string) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(groupId(category))
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">
          How long things last
        </h2>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">
          Days between buys, by category. For a cylinder that is the time between
          refills.
        </p>
      </div>

      {groups.length > 1 && (
        <nav aria-label="Jump to a category" className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.category}
              type="button"
              onClick={() => jumpTo(group.category)}
              className="cursor-pointer rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent/50 hover:bg-accent-soft focus-visible:border-accent focus-visible:outline-none"
            >
              {getCategoryIcon(categories, group.category)} {group.category}
            </button>
          ))}
        </nav>
      )}

      <div className="mt-1 flex flex-col gap-4">
        {groups.map((group) => (
          <LastingCard
            key={group.category}
            group={group}
            icon={getCategoryIcon(categories, group.category)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function LastingCard({
  group,
  icon,
  onSelect,
}: {
  group: LastingGroup;
  icon: string;
  onSelect: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = group.rhythms.length > VISIBLE_ROWS;
  const showAll = expanded || !collapsible;
  const rows = showAll ? group.rhythms : group.rhythms.slice(0, VISIBLE_ROWS);

  return (
    <Card id={groupId(group.category)} className="scroll-mt-6 overflow-hidden">
      <h3 className="flex items-baseline justify-between gap-3 border-b border-border bg-surface-sunk/60 px-5 py-3">
        <span className="font-semibold text-foreground">
          {icon} {group.category}
        </span>
        {group.rhythms.length > 0 && (
          <span className="shrink-0 text-[13px] text-muted">
            {group.rhythms.length} {group.rhythms.length === 1 ? "item" : "items"}
          </span>
        )}
      </h3>

      {rows.length > 0 && (
        <ul className="divide-y divide-border">
          {rows.map((rhythm) => (
            <li key={rhythm.key}>
              <button
                type="button"
                aria-label={`View purchase history for ${rhythm.name}`}
                onClick={() => onSelect(rhythm.key)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-accent-soft/45 focus-visible:bg-accent-soft/45 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-base font-semibold",
                      rhythm.timing === "lapsed" ? "text-muted" : "text-foreground"
                    )}
                  >
                    {rhythm.name}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    {lastingDetail(rhythm)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-right">
                  <span>
                    <span className="block font-display text-2xl font-semibold tabular-nums text-foreground">
                      {rhythm.typicalDays}
                    </span>
                    <span className="block text-xs text-muted">
                      {rhythm.typicalDays === 1 ? "day" : "days"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-accent" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAll && group.learningItems.length > 0 && (
        <div
          className={cn(
            "px-5 py-4",
            rows.length > 0 && "border-t border-border"
          )}
        >
          <p className="text-[13px] text-muted">
            Bought once so far. The next buy will show how long it lasts.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {group.learningItems.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-label={`View purchase details for ${item.name}`}
                onClick={() => onSelect(item.key)}
                className="cursor-pointer rounded-full bg-accent-soft/60 px-3 py-1 text-sm text-foreground transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft/45 focus-visible:bg-accent-soft/45 focus-visible:outline-none"
        >
          {expanded
            ? "Show fewer"
            : `Show all ${group.rhythms.length}` +
              (group.learningItems.length > 0
                ? `, and ${group.learningItems.length} bought once`
                : "")}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      )}
    </Card>
  );
}
