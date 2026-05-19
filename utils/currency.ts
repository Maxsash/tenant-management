export function formatCurrency(
  value: number | string
) {
  return `₹${Number(
    value || 0
  ).toLocaleString("en-IN")}`;
}