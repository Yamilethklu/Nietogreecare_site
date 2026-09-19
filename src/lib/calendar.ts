import { BUSINESS } from "./constants";

/**
 * Utilidades de calendario: calculo de fecha de recordatorio (1 dia antes),
 * exportacion .ics y enlaces a Google Calendar.
 */

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Fecha por defecto de inicio del trabajo: 8:00 AM del dia solicitado. */
export function defaultStartTime(requestedDate: string | null, hour = 8): Date {
  const base = parseDateOnly(requestedDate) ?? new Date();
  base.setHours(hour, 0, 0, 0);
  return base;
}

/** Recordatorio: 1 dia antes del trabajo (requisito del panel de administracion). */
export function reminderDate(start: Date): Date {
  const reminder = addDays(start, -1);
  reminder.setHours(18, 0, 0, 0);
  return reminder;
}

function toIcsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export type CalendarEventInput = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: Date;
  end: Date;
  reminderAt?: Date | null;
  allDay?: boolean;
};

/** Genera un archivo .ics compatible con Google Calendar, Apple Calendar y Outlook. */
export function buildIcs(event: CalendarEventInput): string {
  const reminder = event.reminderAt ?? reminderDate(event.start);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nieto Green Care LLC//Quotes//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}@nietogreencare`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toIcsStamp(event.start)}`,
    `DTEND:${toIcsStamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : "",
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : "",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText("Recordatorio: Nieto Green Care tiene un trabajo manana.")}`,
    `TRIGGER:${toIcsStamp(reminder)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return `${lines.join("\r\n")}\r\n`;
}

/** Enlace para agregar el evento a Google Calendar con recordatorio 1 dia antes. */
export function buildGoogleCalendarUrl(event: {
  title: string;
  description?: string | null;
  location?: string | null;
  start: Date;
  end: Date;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toIcsStamp(event.start)}/${toIcsStamp(event.end)}`,
    details: `${event.description ?? ""}\n\n${BUSINESS.name} · ${BUSINESS.phoneDisplay}`,
    location: event.location ?? BUSINESS.serviceAreaLabel,
    trp: "true",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Rejilla de un mes (domingo a sabado) para el calendario del cotizador. */
export function buildMonthMatrix(year: number, month: number): (Date | null)[][] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** ¿La fecha es valida para agendar? (no domingos, no fechas pasadas) */
export function isDateSelectable(date: Date, today = new Date()): boolean {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() < startOfToday.getTime()) return false;
  return date.getDay() !== 0; // domingo cerrado
}