import { BUSINESS } from "../constants";
import { formatCurrency, formatNumber, truncate } from "../utils";

/**
 * Notificaciones por SMS con Twilio.
 * NOTA: el proyecto usa EXCLUSIVAMENTE Email y SMS. Nunca WhatsApp.
 */

export type SmsResult = {
  ok: boolean;
  provider: "twilio" | "none";
  error?: string;
  sid?: string;
};

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );
}

/** Numero del dueno que recibe las alertas (E.164). */
export function ownerSmsNumber(): string {
  const configured = process.env.OWNER_SMS_NUMBER;
  if (configured) return configured.startsWith("+") ? configured : `+1${configured.replace(/\D/g, "")}`;
  return BUSINESS.phoneE164;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!isSmsConfigured()) {
    return {
      ok: false,
      provider: "none",
      error: "Twilio no esta configurado (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER).",
    };
  }

  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID as string,
      process.env.TWILIO_AUTH_TOKEN as string,
    );

    const message = await client.messages.create({
      to: to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`,
      from: process.env.TWILIO_PHONE_NUMBER as string,
      body,
    });

    return { ok: true, provider: "twilio", sid: message.sid };
  } catch (error) {
    return {
      ok: false,
      provider: "twilio",
      error: error instanceof Error ? error.message : "Error desconocido al enviar el SMS.",
    };
  }
}

export type SmsLeadPayload = {
  referenceCode: string;
  customerName: string;
  customerPhone: string;
  address: string;
  zipCode: string;
  areaSqFt: number;
  estimatedCubicYards: number;
  requestedDate: string | null;
  serviceCount: number;
  paymentMethodLabel: string;
  estimatedPrice?: number | null;
  hasGateCode: boolean;
  adminUrl?: string;
};

/** SMS resumido que recibe el dueno al confirmarse una solicitud. */
export function buildOwnerLeadSms(payload: SmsLeadPayload): string {
  const lines = [
    `NUEVA SOLICITUD ${payload.referenceCode}`,
    `Cliente: ${truncate(payload.customerName, 40)}`,
    `Tel: ${payload.customerPhone}`,
    `Dir: ${truncate(payload.address, 80)} (${payload.zipCode})`,
    `Area: ${formatNumber(payload.areaSqFt)} ft² / ${formatNumber(payload.estimatedCubicYards, 1)} yd³`,
    `Servicios: ${payload.serviceCount}`,
    `Fecha: ${payload.requestedDate || "por definir"}`,
    `Pago: ${payload.paymentMethodLabel}`,
    payload.estimatedPrice ? `Estimado: ${formatCurrency(payload.estimatedPrice)}` : "Estimado: a definir",
    payload.hasGateCode ? "Porton: SI (ver clave en el panel)" : "Porton: no",
    payload.adminUrl ? `Panel: ${payload.adminUrl}` : "",
    "No es una cita confirmada. Revise y confirme la tarifa final.",
  ].filter(Boolean);

  return lines.join("\n");
}

/** SMS de agradecimiento para el cliente (si proporciono su telefono). */
export function buildCustomerSms(
  payload: { referenceCode: string; requestedDate: string | null },
  locale: "es" | "en" = "es",
): string {
  if (locale === "en") {
    return `Nieto Green Care LLC: we received your request ${payload.referenceCode}${
      payload.requestedDate ? ` for ${payload.requestedDate}` : ""
    }. We will contact you shortly to confirm the final rate and date. Thank you! Call ${BUSINESS.phoneDisplay}.`;
  }
  return `Nieto Green Care LLC: recibimos su solicitud ${payload.referenceCode}${
    payload.requestedDate ? ` para el ${payload.requestedDate}` : ""
  }. En un momento nos pondremos en contacto con usted para confirmar la tarifa final y la fecha. Gracias! Tel. ${BUSINESS.phoneDisplay}.`;
}