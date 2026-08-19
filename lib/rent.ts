import { Tenant } from "@/types/tenant";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getRentMonth(
  paymentMonth: string
) {
  const parts = String(paymentMonth).split("-");
  const [year, month] = parts.map(Number);

  if (
    parts.length !== 2 ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12
  ) {
    return paymentMonth;
  }

  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

/**
 * Inverse of getRentMonth: the month a rent payment is due in
 * (rent for June is due in July).
 */
export function getPaymentMonth(
  rentMonth: string
) {
  const parts = String(rentMonth).split("-");
  const [year, month] = parts.map(Number);

  if (
    parts.length !== 2 ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12
  ) {
    return rentMonth;
  }

  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

type RentTenant = Pick<
  Tenant,
  | "base_rent"
  | "base_rent_as_of"
  | "increase_month"
  | "increase_by"
  | "increase_type"
  | "increase_effective_from"
>;

export function calculateRent(
  tenant: RentTenant,
  targetMonth: string
) {
  let rent = Number(tenant.base_rent);

  if (isNaN(rent)) {
    return 0;
  }

  if (
    !tenant.increase_month ||
    !tenant.increase_by
  ) {
    return Math.round(rent);
  }

  const increaseMonthIndex = MONTHS.findIndex(
    (m) =>
      m.toLowerCase() ===
      String(tenant.increase_month)
        .trim()
        .toLowerCase()
  );

  if (increaseMonthIndex === -1) {
    return Math.round(rent);
  }

  const increaseByRaw = tenant.increase_by;

  const increaseBy =
    increaseByRaw === "" ||
    increaseByRaw === null ||
    increaseByRaw === undefined
      ? null
      : Number(increaseByRaw);

  if (increaseBy === null || Number.isNaN(increaseBy)) {
    return Math.round(rent);
  }

  let referenceDate = new Date(
    tenant.base_rent_as_of ?? ""
  );

  const [targetYear, targetMonthNum] =
    targetMonth.split("-");

  const targetDate = new Date(
    Number(targetYear),
    Number(targetMonthNum) - 1,
    1
  );

  // increase_effective_from delays the first application of the schedule —
  // e.g. an agreement whose increase_month/increase_by would otherwise
  // apply every year, but is contractually flat for the first year. Months
  // before it stay flat at base_rent; from it onward, it's used as the walk
  // origin in place of base_rent_as_of (rent hasn't changed between the two,
  // by construction — that's the flat stretch).
  if (tenant.increase_effective_from) {
    const effectiveDate = new Date(
      tenant.increase_effective_from
    );

    if (
      !Number.isNaN(effectiveDate.getTime()) &&
      !Number.isNaN(targetDate.getTime())
    ) {
      if (
        targetDate.getFullYear() <
          effectiveDate.getFullYear() ||
        (targetDate.getFullYear() ===
          effectiveDate.getFullYear() &&
          targetDate.getMonth() <
            effectiveDate.getMonth())
      ) {
        return Math.round(rent);
      }

      referenceDate = effectiveDate;
    }
  }

  if (
    Number.isNaN(referenceDate.getTime()) ||
    Number.isNaN(targetDate.getTime())
  ) {
    // An unparseable base_rent_as_of or malformed targetMonth means we
    // can't walk the increase schedule at all — fall back to the base
    // rent unmodified rather than looping against Invalid Date forever.
    return Math.round(rent);
  }

  const cursor = new Date(referenceDate);

  while (
    cursor.getFullYear() !==
      targetDate.getFullYear() ||
    cursor.getMonth() !==
      targetDate.getMonth()
  ) {
    // moving forward
    if (cursor < targetDate) {
      cursor.setMonth(cursor.getMonth() + 1);

      if (
        cursor.getMonth() ===
        increaseMonthIndex
      ) {
        if (
          tenant.increase_type ===
          "multiplier"
        ) {
          rent = rent * increaseBy;
        } else {
          rent = rent + increaseBy;
        }
      }
    }

    // moving backward
    else {
      if (
        cursor.getMonth() ===
        increaseMonthIndex
      ) {
        if (
          tenant.increase_type ===
          "multiplier"
        ) {
          rent = rent / increaseBy;
        } else {
          rent = rent - increaseBy;
        }
      }

      cursor.setMonth(cursor.getMonth() - 1);
    }
  }

  return Math.round(rent);
}

export function getIncreaseDisplay(
  type: string,
  value: string | number
) {
  if (!type || !value) {
    return "—";
  }

  if (type === "multiplier") {
    const percent =
      (Number(value) - 1) * 100;

    return `${percent.toFixed(0)}%`;
  }

  if (type === "flat") {
    return `₹${Number(value).toLocaleString(
      "en-IN"
    )}`;
  }

  return String(value);
}