const COVERAGE_BY_WEEKDAY: Record<number, readonly string[]> = {
  1: ["Liberty Hill", "Georgetown"],
  2: ["Liberty Hill", "Georgetown"],
  3: ["Leander", "Cedar Park", "Georgetown", "Liberty Hill"],
  4: ["Hutto", "Round Rock", "Georgetown", "Liberty Hill", "Leander"],
  5: ["Hutto", "Round Rock", "Georgetown", "Liberty Hill", "Leander"],
};

const COVERAGE_NOTE_GROUPS = [
  { weekday: 1, daysEs: "Lunes y Martes", daysEn: "Monday and Tuesday" },
  { weekday: 3, daysEs: "Miércoles", daysEn: "Wednesday" },
  { weekday: 4, daysEs: "Jueves y Viernes", daysEn: "Thursday and Friday" },
] as const;

function normalizeCity(city: string): string {
  return city.trim().toLocaleLowerCase("en-US");
}

export function getCoverageCitiesForWeekday(weekday: number): readonly string[] {
  return COVERAGE_BY_WEEKDAY[weekday] ?? [];
}

export function getCoverageNoteLines(isEs: boolean): string[] {
  return COVERAGE_NOTE_GROUPS.map(({ weekday, daysEs, daysEn }) => {
    const dayLabel = isEs ? daysEs : daysEn;
    return `${dayLabel}: ${getCoverageCitiesForWeekday(weekday).join(", ")}.`;
  });
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