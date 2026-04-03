/** Days in month (1–12) for Gregorian calendar. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Random YYYYMMDD with a real calendar day in [yearMin, yearMax] inclusive. */
export function randomDateYmd(yearMin: number, yearMax: number): string {
  if (yearMin > yearMax) throw new RangeError("yearMin must be <= yearMax");
  const y = randomInt(yearMin, yearMax);
  const m = randomInt(1, 12);
  const dMax = daysInMonth(y, m);
  const d = randomInt(1, dMax);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
