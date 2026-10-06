/** Austin y Pflugerville se agendan los días de las ciudades vecinas más cercanas (Cedar Park el miércoles; Round Rock/Hutto jueves y viernes). */
const COVERAGE_BY_WEEKDAY: Record<number, readonly string[]> = {
  1: ["Liberty Hill", "Georgetown"],
  2: ["Liberty Hill", "Georgetown"],
  3: ["Leander", "Cedar Park", "Georgetown", "Liberty Hill", "Austin"],
  4: ["Hutto", "Round Rock", "Georgetown", "Liberty Hill", "Leander", "Austin", "Pflugerville"],
  5: ["Hutto", "Round Rock", "Georgetown", "Liberty Hill", "Leander", "Austin", "Pflugerville"],
};

function normalizeCity(city: string): string {
  return city.trim().toLocaleLowerCase("en-US");
}

export function getCoverageCitiesForWeekday(weekday: number): readonly string[] {
  return COVERAGE_BY_WEEKDAY[weekday] ?? [];
}

export function isDateCoveredForCity(dateKey: string, city: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return false;
  return getCoverageCitiesForWeekday(date.getDay()).some((coveredCity) => normalizeCity(coveredCity) === normalizeCity(city));
}

export function isDateTodayOrLaterInAustin(dateKey: string, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey >= today;
}

export function isInitialServiceDate(dateKey: string, city: string): boolean {
  return isDateTodayOrLaterInAustin(dateKey) && Number(dateKey.slice(8, 10)) <= 14 && isDateCoveredForCity(dateKey, city);
}
