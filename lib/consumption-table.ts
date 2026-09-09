import type {
  ConsumptionMeasure,
  ConsumptionTable,
  ConsumptionTableRow,
  ItemSeries,
  MeasurableCategory,
} from "@/types/expense";

/**
 * Builds the month-by-month grid behind the consumption screen: one row per
 * item, one column per month.
 *
 * Sparklines could not answer "how much onion did we get through in August",
 * which is the whole reason quantities are recorded, so the numbers are laid
 * out to be read directly and compared down a column.
 *
 * A table only ever covers ONE unit. Kilos and pieces cannot share a column
 * of numbers without inviting a comparison that is not real, so the dominant
 * unit for the category wins and anything else is named separately for the
 * reader rather than silently dropped.
 */

/** Categories worth offering, biggest first, with the unit their table uses. */
export function listMeasurableCategories(
  items: ItemSeries[]
): MeasurableCategory[] {
  const byCategory = new Map<string, ItemSeries[]>();

  for (const item of items) {
    if (!item.unit || item.mixedUnits) continue;
    if (!item.quantities.some((q) => q !== null)) continue;

    const bucket = byCategory.get(item.category);
    if (bucket) bucket.push(item);
    else byCategory.set(item.category, [item]);
  }

  const categories: MeasurableCategory[] = [];

  for (const [category, categoryItems] of byCategory) {
    const unit = dominantUnitOf(categoryItems);
    if (!unit) continue;

    const inUnit = categoryItems.filter((i) => i.unit === unit);
    categories.push({
      category,
      unit,
      itemCount: inUnit.length,
      spend: total(inUnit.flatMap((i) => i.amounts)),
      coherence: round(inUnit.length / categoryItems.length, 3),
    });
  }

  // Ranked by how many items a single-unit table would actually cover,
  // discounted by how much of the category it leaves out. Two competing
  // failures are being avoided: Groceries outspends everything but is measured
  // in packets, litres, pieces and kilos at once, so its table would say more
  // about what it omitted than what it showed; and a tidy two-item category
  // measured purely in pieces is perfectly coherent but has nothing to read.
  // Vegetables are both numerous and almost entirely kilos, so they win.
  const score = (c: MeasurableCategory) => c.coherence * c.itemCount;

  return categories.sort((a, b) => score(b) - score(a) || b.spend - a.spend);
}

export function buildConsumptionTable(
  items: ItemSeries[],
  category: string,
  measure: ConsumptionMeasure
): ConsumptionTable | null {
  const inCategory = items.filter(
    (i) =>
      i.category === category &&
      i.unit !== null &&
      !i.mixedUnits &&
      i.quantities.some((q) => q !== null)
  );

  const unit = dominantUnitOf(inCategory);
  if (!unit) return null;

  const inUnit = inCategory.filter((i) => i.unit === unit);
  const otherUnits = inCategory
    .filter((i) => i.unit !== unit)
    .map((i) => ({ name: i.name, unit: i.unit as string }));

  const rows: ConsumptionTableRow[] = inUnit
    .map((item) => {
      const values =
        measure === "quantity"
          ? item.quantities
          : measure === "rate"
            ? item.rates
            : item.amounts.map((a) => (a > 0 ? a : null));

      return {
        key: item.key,
        name: item.name,
        values,
        // Shading is scaled inside its own row: an item's own busiest month is
        // the darkest cell, so a staple bought by the kilo does not wash out a
        // spice bought by the gram.
        peak: Math.max(...values.map((v) => v ?? 0), 0),
        total: rowTotal(item, measure),
      };
    })
    // Quantity is comparable inside a single unit, so the staples lead.
    .sort((a, b) => quantityOf(b, inUnit) - quantityOf(a, inUnit));

  return {
    category,
    unit,
    measure,
    rows,
    totalRow: buildTotalRow(inUnit, measure),
    otherUnits,
  };
}

/** The unit most of a category's items are measured in. */
function dominantUnitOf(items: ItemSeries[]): string | null {
  const counts = new Map<string, number>();

  for (const item of items) {
    if (!item.unit) continue;
    counts.set(item.unit, (counts.get(item.unit) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;

  for (const [unit, count] of counts) {
    if (count > bestCount) {
      best = unit;
      bestCount = count;
    }
  }

  return best;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function total(values: (number | null)[]): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function quantityOf(row: ConsumptionTableRow, items: ItemSeries[]): number {
  const item = items.find((i) => i.key === row.key);
  return item ? total(item.quantities) : 0;
}

function rowTotal(item: ItemSeries, measure: ConsumptionMeasure): number | null {
  if (measure === "quantity") return round(total(item.quantities), 3);
  if (measure === "amount") return round(total(item.amounts), 2);

  // A total rate is the blended rate over the window, not an average of
  // averages, which would weight a one-off purchase the same as a big one.
  // Only priced-and-weighed rows may be divided — see ItemSeries.
  const quantity = total(item.pricedQuantities);
  const spend = total(item.pricedAmounts);

  return quantity > 0 && spend > 0 ? round(spend / quantity, 2) : null;
}

function buildTotalRow(
  items: ItemSeries[],
  measure: ConsumptionMeasure
): ConsumptionTableRow | null {
  if (items.length === 0) return null;

  const monthCount = items[0].quantities.length;
  const quantities = Array.from({ length: monthCount }, (_, i) =>
    total(items.map((item) => item.quantities[i]))
  );
  const amounts = Array.from({ length: monthCount }, (_, i) =>
    total(items.map((item) => item.amounts[i]))
  );
  const pricedQuantities = Array.from({ length: monthCount }, (_, i) =>
    total(items.map((item) => item.pricedQuantities[i]))
  );
  const pricedAmounts = Array.from({ length: monthCount }, (_, i) =>
    total(items.map((item) => item.pricedAmounts[i]))
  );

  const values =
    measure === "quantity"
      ? quantities.map((q) => (q > 0 ? round(q, 3) : null))
      : measure === "amount"
        ? amounts.map((a) => (a > 0 ? round(a, 2) : null))
        : pricedQuantities.map((q, i) =>
            q > 0 && pricedAmounts[i] > 0
              ? round(pricedAmounts[i] / q, 2)
              : null
          );

  const overallQuantity = total(pricedQuantities);
  const overallSpend = total(pricedAmounts);

  return {
    key: "__total",
    name: "All together",
    values,
    peak: Math.max(...values.map((v) => v ?? 0), 0),
    total:
      measure === "quantity"
        ? round(total(quantities), 3)
        : measure === "amount"
          ? round(total(amounts), 2)
          : overallQuantity > 0
            ? round(overallSpend / overallQuantity, 2)
            : null,
  };
}
