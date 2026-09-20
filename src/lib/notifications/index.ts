import { BUSINESS, PAYMENT_METHODS, SERVICE_MAP } from "../constants";
import type { Lead } from "../types";
import { formatDate, toNumber } from "../utils";
import { customerConfirmationEmail, ownerLeadEmail, type EmailLeadPayload } from "./templates";
import { sendEmail } from "./email";
import {
  buildCustomerSms,
  buildOwnerLeadSms,
  isSmsConfigured,
  ownerSmsNumber,
  sendSms,
} from "./sms";

export type AppointmentNotificationLead = LeadLike & {
  customer_email?: string | null;
  final_price?: number | string | null;
  scheduled_for?: string | null;
};

/**
 * Orquestador de notificaciones.
 * Canales soportados: Email (Resend / SMTP) y SMS (Twilio). Nunca WhatsApp.
 */

export type LeadLike = Pick<
  Lead,
  | "reference_code"
  | "customer_name"
  | "customer_phone"
  | "address"
  | "zip_code"
  | "city"
  | "requested_date"
  | "requested_time_window"
  | "area_sq_ft"
  | "estimated_cubic_yards"
  | "depth_inches"
  | "has_gate_code"
  | "gate_code"
  | "selected_services"
  | "service_count"
  | "payment_method"
  | "details"
  | "additional_notes"
  | "snapshot_url"
>;

export type ChannelResult = {
  channel: "email" | "sms";
  target: string;
  ok: boolean;
  provider: string;
  error?: string;
};

export type NotificationSummary = {
  results: ChannelResult[];
  emailSent: boolean;
  smsSent: boolean;
  errors: string[];
};

export function paymentMethodLabel(method: string, locale: "es" | "en" = "es"): string {
  const found = PAYMENT_METHODS.find((option) => option.key === method);
  if (!found) return method;
  return locale === "es" ? found.labelEs : found.labelEn;
}

export function serviceNames(
  keys: string[] | null | undefined,
  locale: "es" | "en" = "es",
): string[] {
  return (keys ?? []).map((key) => {
    const service = SERVICE_MAP[key];
    if (!service) return key;
    return locale === "es" ? service.nameEs : service.nameEn;
  });
}

function toPayload(lead: LeadLike, locale: "es" | "en", adminUrl?: string): EmailLeadPayload {
  return {
    referenceCode: lead.reference_code,
    customerName: lead.customer_name,
    customerPhone: lead.customer_phone,
    address: lead.address,
    zipCode: lead.zip_code,
    city: lead.city,
    requestedDate: lead.requested_date,
    requestedTimeWindow: lead.requested_time_window,
    areaSqFt: toNumber(lead.area_sq_ft),
    estimatedCubicYards: toNumber(lead.estimated_cubic_yards),
    depthInches: toNumber(lead.depth_inches, 2),
    hasGateCode: Boolean(lead.has_gate_code),
    gateCode: lead.gate_code,
    selectedServices: lead.selected_services ?? [],
    serviceNames: serviceNames(lead.selected_services, locale),
    paymentMethodLabel: paymentMethodLabel(lead.payment_method, locale),
    details: lead.details,
    additionalNotes: lead.additional_notes,
    snapshotUrl: lead.snapshot_url,
    adminUrl,
  };
}

/** Notifica al dueno por Email + SMS (los canales que esten configurados). */
export async function notifyOwnerOfLead(
  lead: LeadLike,
  options: { adminUrl?: string } = {},
): Promise<NotificationSummary> {
  const payload = toPayload(lead, "es", options.adminUrl);
  const results: ChannelResult[] = [];

  // --- Correo electronico ---
  const emailTarget = process.env.EMAIL_TO || BUSINESS.email;
  const template = ownerLeadEmail(payload);
  const email = await sendEmail({
    to: emailTarget,
    subject: template.subject,
    html: template.html,
  });
  results.push({
    channel: "email",
    target: emailTarget,
    ok: email.ok,
    provider: email.provider,
    error: email.error,
  });

  // --- SMS ---
  const smsTarget = ownerSmsNumber();
  if (isSmsConfigured()) {
    const sms = await sendSms(
      smsTarget,
      buildOwnerLeadSms({
        referenceCode: lead.reference_code,
        customerName: lead.customer_name,
        customerPhone: lead.customer_phone,
        address: lead.address,
        zipCode: lead.zip_code,
        areaSqFt: toNumber(lead.area_sq_ft),
        estimatedCubicYards: toNumber(lead.estimated_cubic_yards),
        requestedDate: lead.requested_date,
        serviceCount: lead.service_count ?? lead.selected_services?.length ?? 0,
        paymentMethodLabel: paymentMethodLabel(lead.payment_method, "es"),
        hasGateCode: Boolean(lead.has_gate_code),
        adminUrl: options.adminUrl,
      }),
    );
    results.push({
      channel: "sms",
      target: smsTarget,
      ok: sms.ok,
      provider: sms.provider,
      error: sms.error,
    });
  } else {
    results.push({
      channel: "sms",
      target: smsTarget,
      ok: false,
      provider: "none",
      error: "Twilio no configurado.",
    });
  }

  return {
    results,
    emailSent: results.find((item) => item.channel === "email")?.ok ?? false,
    smsSent: results.find((item) => item.channel === "sms")?.ok ?? false,
    errors: results
      .filter((item) => !item.ok && item.error)
      .map((item) => `${item.channel}: ${item.error}`),
  };
}

/** Envia la confirmacion de agradecimiento al cliente (email y SMS opcionales). */
export async function notifyCustomerOfLead(
  lead: LeadLike & { email?: string | null },
  locale: "es" | "en" = "es",
): Promise<NotificationSummary> {
  const payload = toPayload(lead, locale);
  const results: ChannelResult[] = [];
  const template = customerConfirmationEmail(payload, locale);

  if (lead.email) {
    const email = await sendEmail({
      to: lead.email,
      subject: template.subject,
      html: template.html,
    });
    results.push({
      channel: "email",
      target: lead.email,
      ok: email.ok,
      provider: email.provider,
      error: email.error,
    });
  }

  if (lead.customer_phone && isSmsConfigured()) {
    const sms = await sendSms(
      lead.customer_phone,
      buildCustomerSms(
        { referenceCode: lead.reference_code, requestedDate: lead.requested_date },
        locale,
      ),
    );
    results.push({
      channel: "sms",
      target: lead.customer_phone,
      ok: sms.ok,
      provider: sms.provider,
      error: sms.error,
    });
  }

  return {
    results,
    emailSent: results.some((item) => item.channel === "email" && item.ok),
    smsSent: results.some((item) => item.channel === "sms" && item.ok),
    errors: results
      .filter((item) => !item.ok && item.error)
      .map((item) => `${item.channel}: ${item.error}`),
  };
}

/** Confirma una cita agendada al cliente con la fecha de trabajo y tarifa acordada. */
export async function notifyCustomerOfAppointment(
  lead: AppointmentNotificationLead,
): Promise<NotificationSummary> {
  const scheduledAt = lead.scheduled_for || lead.requested_date;
  const scheduledLabel = scheduledAt ? formatDate(scheduledAt) : "por definir";
  const amount = Number(lead.final_price ?? 0);
  const priceLabel = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  const services = serviceNames(lead.selected_services).join(", ") || "Servicio de jardinería";
  const results: ChannelResult[] = [];

  const subject = `Cita confirmada — Nieto Green Care (${lead.reference_code})`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172018"><h2>Su cita está confirmada</h2><p>Hola ${lead.customer_name},</p><p>Hemos agendado su servicio con Nieto Green Care LLC.</p><ul><li><strong>Fecha:</strong> ${scheduledLabel}</li><li><strong>Dirección:</strong> ${lead.address}</li><li><strong>Servicios:</strong> ${services}</li><li><strong>Tarifa acordada:</strong> ${priceLabel}</li></ul><p>Si necesita hacer algún cambio, llámenos al ${BUSINESS.phoneDisplay}.</p></div>`;

  if (lead.customer_email) {
    const email = await sendEmail({ to: lead.customer_email, subject, html });
    results.push({ channel: "email", target: lead.customer_email, ok: email.ok, provider: email.provider, error: email.error });
  }

  if (lead.customer_phone && isSmsConfigured()) {
    const sms = await sendSms(
      lead.customer_phone,
      `Nieto Green Care LLC: su cita ${lead.reference_code} está agendada para ${scheduledLabel}. Tarifa acordada: ${priceLabel}. Dirección: ${lead.address}. Tel. ${BUSINESS.phoneDisplay}.`,
    );
    results.push({ channel: "sms", target: lead.customer_phone, ok: sms.ok, provider: sms.provider, error: sms.error });
  }

  return {
    results,
    emailSent: results.some((item) => item.channel === "email" && item.ok),
    smsSent: results.some((item) => item.channel === "sms" && item.ok),
    errors: results.filter((item) => !item.ok && item.error).map((item) => `${item.channel}: ${item.error}`),
  };
}

/** Resumen de texto plano usado en el panel de administracion. */
export function leadSummaryLines(lead: LeadLike): string[] {
  return [
    `Folio: ${lead.reference_code}`,
    `Cliente: ${lead.customer_name} · ${lead.customer_phone}`,
    `Direccion: ${lead.address} (${lead.zip_code})`,
    `Area: ${Math.round(toNumber(lead.area_sq_ft))} ft² · ${toNumber(lead.estimated_cubic_yards).toFixed(2)} yd³`,
    `Fecha: ${lead.requested_date ? formatDate(lead.requested_date) : "por definir"}`,
    `Pago: ${paymentMethodLabel(lead.payment_method)}`,
  ];
}
