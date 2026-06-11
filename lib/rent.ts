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
  const [year, month] = String(paymentMonth)
    .split("-")
    .map(Number);

  if (
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