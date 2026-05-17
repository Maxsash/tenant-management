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

const REFERENCE_MONTH = "2026-05";

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

  const increaseBy = Number(
    tenant.increase_by
  );

  const referenceDate = new Date(
    2026,
    4,
    1
  ); // May 2026

  const [targetYear, targetMonthNum] =
    targetMonth.split("-");

  const targetDate = new Date(
    Number(targetYear),
    Number(targetMonthNum) - 1,
    1
  );

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