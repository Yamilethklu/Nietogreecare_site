import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deja unicamente los digitos de un string. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Formatea un telefono de 10 digitos como 512-555-0123. */
export function formatPhone(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  if (digits.length === 11 && digits.startsWith("1")) {
    return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value ?? "";
}

/** Formatea un numero a moneda USD sin decimales cuando es entero. */
export function formatCurrency(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(safe) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/** Numero con separador de miles. */
export function formatNumber(value: number | string | null | undefined, digits = 0): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe);
}

/** Formatea una fecha ISO (YYYY-MM-DD) o Date a formato legible. */
export function formatDate(
  value: string | Date | null | undefined,
  locale = "es-TX",
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/** Fecha de hoy en formato ISO corto (YYYY-MM-DD). */
export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

/** Genera un codigo de referencia legible para la solicitud. */
export function buildReferenceCode(date = new Date()): string {
  const stamp = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `NGC-${stamp}-${random}`;
}

/** Iniciales para avatares. */
export function initials(name: string | null | undefined): string {
  if (!name) return "NG";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Convierte un string a slug seguro para rutas de Storage. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Trunca texto para tarjetas. */
export function truncate(value: string | null | undefined, max = 120): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Espera asincrona util para reintentos. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lee un objeto anidado sin lanzar errores. */
export function getPath<T = unknown>(obj: unknown, path: string): T | undefined {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as T | undefined;
}

/** Numero seguro desde string|number|numeric de Postgres. */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}