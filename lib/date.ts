export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}
