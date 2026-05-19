export function formatIncrease(
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