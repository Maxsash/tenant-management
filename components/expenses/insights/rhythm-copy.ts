import type { PaymentRound, PurchaseRhythm } from "@/types/expense";
import { formatQuantity } from "@/utils/currency";
import { formatShortDate } from "@/utils/date";

export function dayLabel(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function agoLabel(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${dayLabel(days)} ago`;
}

/** The short status beside an item in a list. */
export function dueLabel(rhythm: PurchaseRhythm) {
  if (rhythm.timing === "lapsed") {
    return rhythm.kind === "payment" ? "Not paid for a while" : "Not bought for a while";
  }
  if (rhythm.timing === "now") return "Due now";
  if (rhythm.timing === "soon") {
    return rhythm.dueInDays === 1 ? "Tomorrow" : `In about ${dayLabel(rhythm.dueInDays)}`;
  }
  return `Around ${formatShortDate(rhythm.nextDueOn)}`;
}

/** The headline of the detail sheet. */
export function timingLabel(rhythm: PurchaseRhythm) {
  if (rhythm.kind === "payment") {
    if (rhythm.timing === "lapsed") return "Not paid for a while";
    if (rhythm.timing === "now") return "Due around now";
    if (rhythm.dueInDays === 1) return "Due tomorrow";
    if (rhythm.timing === "soon") return `Due in about ${dayLabel(rhythm.dueInDays)}`;
    return `Next due around ${formatShortDate(rhythm.nextDueOn)}`;
  }

  if (rhythm.timing === "lapsed") return "Not bought for a while";
  if (rhythm.timing === "now") return "May be needed around now";
  if (rhythm.dueInDays === 1) return "May be needed tomorrow";
  if (rhythm.timing === "soon") {
    return `May be needed in about ${dayLabel(rhythm.dueInDays)}`;
  }
  return `May be needed around ${formatShortDate(rhythm.nextDueOn)}`;
}

export function lastBoughtLabel(rhythm: PurchaseRhythm) {
  const verb = rhythm.kind === "payment" ? "Paid" : "Bought";
  return `${verb} ${agoLabel(rhythm.daysSinceLast)}`;
}

/** "Usually 3 kg", or "Usually 1 at a time" for a cylinder logged without a
 *  unit, where a bare "Usually 1" reads like a typo. */
export function usualQuantityLabel(rhythm: PurchaseRhythm) {
  if (rhythm.typicalQuantity === null) return null;
  const quantity = formatQuantity(rhythm.typicalQuantity, rhythm.unit);
  return rhythm.unit ? `Usually ${quantity}` : `Usually ${quantity} at a time`;
}

/** The line under an item's name in "How long things last". */
export function lastingDetail(rhythm: PurchaseRhythm) {
  const usual = usualQuantityLabel(rhythm);
  const recency =
    rhythm.timing === "lapsed"
      ? "not bought for a while"
      : `bought ${agoLabel(rhythm.daysSinceLast)}`;

  return usual ? `${usual} · ${recency}` : capitalise(recency);
}

export function roundTitle(round: PaymentRound) {
  return round.dueOn ? `Around ${formatShortDate(round.dueOn)}` : "Not paid for a while";
}

export function roundDetail(round: PaymentRound) {
  const count = `${round.payments.length} ${round.payments.length === 1 ? "payment" : "payments"}`;
  if (!round.dueOn) return `${count} that used to be regular`;

  const days = round.payments[0].dueInDays;
  if (round.timing === "now") return `Due now · ${count}`;
  if (days === 1) return `Tomorrow · ${count}`;
  return `In about ${dayLabel(days)} · ${count}`;
}

export function cycleLabel(rhythm: PurchaseRhythm) {
  if (rhythm.monthly) return "Paid";
  return rhythm.kind === "payment" ? "Paid about every" : "Usually lasts";
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

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
