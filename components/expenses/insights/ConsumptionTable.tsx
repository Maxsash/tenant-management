"use client";

import Card from "@/components/ui/Card";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { formatMonthShort } from "@/utils/date";
import { cn } from "@/utils/cn";
import type {
  ConsumptionMeasure,
  ConsumptionTable as Table,
  ConsumptionTableRow,
  MeasurableCategory,
  MonthInsight,
} from "@/types/expense";

/** Naming a handful is a useful footnote; naming twenty is a wall of text. */
const NAMED_OTHER_UNITS = 5;

type Props = {
  table: Table | null;
  categories: MeasurableCategory[];
  category: string;
  onCategoryChange: (category: string) => void;
  measure: ConsumptionMeasure;
  onMeasureChange: (measure: ConsumptionMeasure) => void;
  months: MonthInsight[];
  monthIndex: number;
};

/** Cells carry the number; shading is a second, redundant read of the same
 *  value, so nothing is encoded in colour alone. */
function shade(value: number | null, peak: number) {
  if (value === null || peak <= 0) return undefined;
  // Capped well below full strength so the ink on top always stays legible.
  return { backgroundColor: `color-mix(in oklab, var(--color-accent) ${Math.round((value / peak) * 22)}%, transparent)` };
}

function formatCell(
  value: number | null,
  measure: ConsumptionMeasure
): string {
  if (value === null) return "–";
  if (measure === "quantity") return String(Math.round(value * 100) / 100);
  return Math.round(value).toLocaleString("en-IN");
}

export default function ConsumptionTable({
  table,
  categories,
  category,
  onCategoryChange,
  measure,
  onMeasureChange,
  months,
  monthIndex,
}: Props) {
  const measures = [
    { value: "quantity", label: table ? table.unit : "Quantity" },
    { value: "rate", label: table ? `₹/${table.unit}` : "Rate" },
    { value: "amount", label: "₹ spent" },
  ];

  function renderRow(row: ConsumptionTableRow, isTotal = false) {
    return (
      <tr
        key={row.key}
        className={cn(
          "border-t border-border",
          isTotal && "bg-accent-soft font-semibold"
        )}
      >
        <th
          scope="row"
          className={cn(
            // Sticky so the item stays readable while the months scroll.
            "sticky left-0 z-10 max-w-[7.5rem] truncate px-3 py-2.5 text-left text-[13px] font-medium",
            isTotal ? "bg-accent-soft font-semibold" : "bg-surface"
          )}
        >
          {row.name}
        </th>

        {row.values.map((value, i) => (
          <td
            key={i}
            style={isTotal ? undefined : shade(value, row.peak)}
            className={cn(
              "px-2.5 py-2.5 text-right text-[13px] tabular-nums whitespace-nowrap",
              value === null ? "text-muted" : "text-foreground",
              i === monthIndex && "font-semibold"
            )}
          >
            {formatCell(value, measure)}
          </td>
        ))}

        <td className="border-l border-border px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums whitespace-nowrap text-foreground">
          {formatCell(row.total, measure)}
        </td>
      </tr>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Month by month
        </h2>
        <p className="text-sm text-muted">
          How much of each thing came into the house.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {categories.length > 1 && (
          <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-surface px-4 shadow-card">
            <span className="sr-only">Category</span>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full bg-transparent text-[15px] font-medium text-foreground outline-none"
            >
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.itemCount})
                </option>
              ))}
            </select>
          </label>
        )}

        <SegmentedControl
          options={measures}
          value={measure}
          onChange={(v) => onMeasureChange(v as ConsumptionMeasure)}
          ariaLabel="What to show in the table"
        />
      </div>

      {!table || table.rows.length === 0 ? (
        <Card className="p-5 text-sm text-muted">
          Nothing measured in this category yet.
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            {/* Wide content scrolls inside its own box, never the page. */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <caption className="sr-only">
                  {table.category} by month, in{" "}
                  {measure === "quantity"
                    ? table.unit
                    : measure === "rate"
                      ? `rupees per ${table.unit}`
                      : "rupees"}
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted uppercase"
                    >
                      {measure === "quantity"
                        ? table.unit
                        : measure === "rate"
                          ? `₹/${table.unit}`
                          : "₹"}
                    </th>
                    {months.map((m, i) => (
                      <th
                        key={m.month}
                        scope="col"
                        className={cn(
                          "px-2.5 py-2.5 text-right text-[11px] font-semibold tracking-wide uppercase",
                          i === monthIndex ? "text-foreground" : "text-muted"
                        )}
                      >
                        {formatMonthShort(m.month)}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="border-l border-border px-3 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase"
                    >
                      All
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.totalRow && renderRow(table.totalRow, true)}
                  {table.rows.map((row) => renderRow(row))}
                </tbody>
              </table>
            </div>
          </Card>

          {table.otherUnits.length > 0 && (
            <p className="text-xs text-muted">
              Not in this table because {table.otherUnits.length === 1 ? "it is" : "they are"}{" "}
              measured differently:{" "}
              {table.otherUnits
                .slice(0, NAMED_OTHER_UNITS)
                .map((o) => `${o.name} (${o.unit})`)
                .join(", ")}
              {table.otherUnits.length > NAMED_OTHER_UNITS &&
                ` and ${table.otherUnits.length - NAMED_OTHER_UNITS} more`}
              .
            </p>
          )}
        </>
      )}
    </section>
  );
}
