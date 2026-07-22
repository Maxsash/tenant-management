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

export function calculateRent(
  tenant: any,
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

  const referenceDate = new Date(
    tenant.base_rent_as_of
  );

  const [targetYear, targetMonthNum] =
    targetMonth.split("-");

  const targetDate = new Date(
    Number(targetYear),
    Number(targetMonthNum) - 1,
    1
  );

  if (
    Number.isNaN(referenceDate.getTime()) ||
    Number.isNaN(targetDate.getTime())
  ) {
    // An unparseable base_rent_as_of or malformed targetMonth means we
    // can't walk the increase schedule at all — fall back to the base
    // rent unmodified rather than looping against Invalid Date forever.
    return Math.round(rent);
  }

  let cursor = new Date(referenceDate);

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