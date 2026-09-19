import type { PurchaseRhythm } from "@/types/expense";

export function dayLabel(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function timingLabel(rhythm: PurchaseRhythm) {
  if (rhythm.timing === "now") return "May be needed around now";
  if (rhythm.dueInDays === 1) return "May be needed tomorrow";
  return `May be needed in about ${dayLabel(rhythm.dueInDays)}`;
}

export function lastBoughtLabel(rhythm: PurchaseRhythm) {
  if (rhythm.daysSinceLast === 0) return "Bought today";
  if (rhythm.daysSinceLast === 1) return "Bought yesterday";
  return `Bought ${dayLabel(rhythm.daysSinceLast)} ago`;
}

export function evidenceLabel(rhythm: PurchaseRhythm) {
  if (rhythm.intervalCount === 1) {
    return `The last gap was ${dayLabel(rhythm.lastGapDays)}`;
  }

  return `Last gap: ${dayLabel(rhythm.lastGapDays)} · ${rhythm.purchaseCount} buys recorded`;
}

export function recentRangeLabel(rhythm: PurchaseRhythm) {
  if (rhythm.intervalCount === 1) {
    return "This is an early estimate from one gap.";
  }

  if (rhythm.recentMinDays === rhythm.recentMaxDays) {
    return `Recent gaps were all ${dayLabel(rhythm.recentMinDays)}.`;
  }

  return `Recent gaps ranged from ${dayLabel(rhythm.recentMinDays)} to ${dayLabel(rhythm.recentMaxDays)}.`;
}
