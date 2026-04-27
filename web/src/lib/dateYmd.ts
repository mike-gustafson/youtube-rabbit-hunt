/** Days in month (1–12) for Gregorian calendar. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Random YYYYMMDD with a real calendar day in [yearMin, yearMax] inclusive and never in the future (UTC). */
export function randomDateYmd(yearMin: number, yearMax: number): string {
  if (yearMin > yearMax) throw new RangeError("yearMin must be <= yearMax");
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  const upperYear = Math.min(yearMax, currentYear);
  if (yearMin > upperYear) {
    throw new RangeError("No valid date range at or before today.");
  }

  const y = randomInt(yearMin, upperYear);
  const monthUpper = y === currentYear ? currentMonth : 12;
  const m = randomInt(1, monthUpper);
  const dMax = daysInMonth(y, m);
  const dayUpper = y === currentYear && m === currentMonth ? Math.min(currentDay, dMax) : dMax;
  const d = randomInt(1, dayUpper);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
