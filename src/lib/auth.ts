import { ADMIN_EMAILS } from "./constants";

/**
 * Lista blanca de correos autorizados para el panel /admin
 * (Supabase Auth con email/password y Google OAuth).
 */

export function getAdminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const combined = new Set<string>([
    ...ADMIN_EMAILS.map((email) => email.toLowerCase()),
    ...fromEnv,
  ]);

  return Array.from(combined);
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export const ALLOWED_AUTH_DOMAIN_NOTE =
  "Solo los correos autorizados de Nieto Green Care LLC pueden acceder al panel.";
