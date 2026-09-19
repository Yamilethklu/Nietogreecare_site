import { BUSINESS } from "../constants";
import { cubicYardsFromArea, squareFeetToSquareYards } from "../geo";
import { formatDate, formatNumber } from "../utils";

/**
 * Plantillas HTML elegantes (verde bosque + dorado) para las notificaciones.
 * Solo se usan canales de Email y SMS; nunca WhatsApp.
 */

const COLORS = {
  forestDark: "#0A2A17",
  forest: "#14532D",
  forestBright: "#166534",
  ink: "#090D16",
  wood: "#78350F",
  gold: "#C9A227",
  goldSoft: "#EBD79A",
  surface: "#111827",
  text: "#E5E7EB",
  muted: "#9CA3AF",
};

const escapeHtml = (value: string | number | null | undefined): string =>
  String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Row = { label: string; value: string };

function rowsToHtml(rows: Row[]): string {
  return rows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid rgba(201,162,39,0.18);color:${COLORS.muted};font-size:13px;white-space:nowrap;">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid rgba(201,162,39,0.18);color:${COLORS.text};font-size:14px;font-weight:600;">
            ${escapeHtml(row.value)}
          </td>
        </tr>`,
    )
    .join("");
}

function shell(title: string, subtitle: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:${COLORS.ink};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
      <tr>
        <td style="background:linear-gradient(135deg,${COLORS.forestDark},${COLORS.forest});padding:28px 24px;border-radius:18px 18px 0 0;border:1px solid rgba(201,162,39,0.35);border-bottom:none;">
          <div style="color:${COLORS.goldSoft};font-size:11px;letter-spacing:3px;text-transform:uppercase;">Nieto Green Care LLC</div>
          <div style="color:#FFFFFF;font-size:24px;font-family:Georgia,'Times New Roman',serif;margin-top:8px;">${escapeHtml(title)}</div>
          <div style="color:rgba(255,255,255,0.78);font-size:13px;margin-top:6px;">${escapeHtml(subtitle)}</div>
        </td>
      </tr>
      <tr>
        <td style="background:${COLORS.surface};border:1px solid rgba(201,162,39,0.28);border-top:none;border-radius:0 0 18px 18px;padding:22px;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:18px 8px;color:${COLORS.muted};font-size:12px;line-height:20px;">
          <strong style="color:${COLORS.goldSoft};">Nieto Green Care LLC</strong><br />
          ${escapeHtml(BUSINESS.serviceAreaLabelEs)}<br />
          Tel. ${escapeHtml(BUSINESS.phoneDisplay)} · ${escapeHtml(BUSINESS.email)}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type EmailLeadPayload = {
  referenceCode: string;
  customerName: string;
  customerPhone: string;
  address: string;
  zipCode: string;
  city?: string | null;
  requestedDate: string | null;
  requestedTimeWindow?: string | null;
  areaSqFt: number;
  estimatedCubicYards: number;
  depthInches: number;
  hasGateCode: boolean;
  gateCode?: string | null;
  selectedServices: string[];
  serviceNames: string[];
  paymentMethodLabel: string;
  details?: string | null;
  additionalNotes?: string | null;
  snapshotUrl?: string | null;
  adminUrl?: string;
};

/** Correo interno para el dueno con todos los datos del lead. */
export function ownerLeadEmail(payload: EmailLeadPayload): { subject: string; html: string } {
  const metrics = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td style="background:rgba(22,101,52,0.16);border:1px solid rgba(201,162,39,0.3);border-radius:14px;padding:16px;text-align:center;">
          <div style="color:${COLORS.goldSoft};font-size:11px;letter-spacing:2px;text-transform:uppercase;">Area medida</div>
          <div style="color:#FFFFFF;font-size:26px;font-weight:700;margin-top:6px;">${formatNumber(payload.areaSqFt)} ft²</div>
          <div style="color:${COLORS.muted};font-size:13px;margin-top:4px;">
            ${formatNumber(squareFeetToSquareYards(payload.areaSqFt), 1)} sq yd · ${formatNumber(cubicYardsFromArea(payload.areaSqFt, payload.depthInches), 2)} yd³ estimadas
          </div>
        </td>
      </tr>
    </table>`;

  const rows: Row[] = [
    { label: "Folio", value: payload.referenceCode },
    { label: "Cliente", value: payload.customerName },
    { label: "Telefono", value: payload.customerPhone },
    { label: "Direccion", value: payload.address },
    {
      label: "Codigo postal",
      value: `${payload.zipCode}${payload.city ? ` · ${payload.city}` : ""}`,
    },
    {
      label: "Fecha solicitada",
      value: payload.requestedDate ? formatDate(payload.requestedDate) : "Por definir",
    },
    { label: "Horario preferido", value: payload.requestedTimeWindow || "Flexible" },
    { label: "Servicios", value: payload.serviceNames.join(", ") || "—" },
    {
      label: "Porton con clave",
      value: payload.hasGateCode ? `SI · ${payload.gateCode || "sin especificar"}` : "No",
    },
    { label: "Metodo de pago", value: payload.paymentMethodLabel },
    { label: "Detalles", value: payload.details || "—" },
    { label: "Notas del cliente", value: payload.additionalNotes || "—" },
  ];

  const snapshot = payload.snapshotUrl
    ? `<div style="margin-top:18px;">
         <div style="color:${COLORS.goldSoft};font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Recorte satelital del area</div>
         <img src="${escapeHtml(payload.snapshotUrl)}" alt="Area medida" style="width:100%;border-radius:12px;border:1px solid rgba(201,162,39,0.35);" />
       </div>`
    : "";

  const adminButton = payload.adminUrl
    ? `<div style="margin-top:22px;text-align:center;">
         <a href="${escapeHtml(payload.adminUrl)}" style="display:inline-block;background:${COLORS.forestBright};color:#FFFFFF;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:700;font-size:14px;border:1px solid rgba(201,162,39,0.5);">
           Abrir en el panel de control
         </a>
       </div>`
    : "";

  return {
    subject: `Nueva solicitud ${payload.referenceCode} — ${payload.customerName} (${formatNumber(payload.areaSqFt)} ft²)`,
    html: shell(
      "Nueva solicitud de cotizacion",
      "Un cliente completo el cotizador paso a paso.",
      `${metrics}
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsToHtml(rows)}</table>
       ${snapshot}
       ${adminButton}
       <p style="color:${COLORS.muted};font-size:12px;margin-top:20px;">
         Nota: la solicitud no constituye un cobro automatico ni una cita confirmada.
       </p>`,
    ),
  };
}

/** Correo de agradecimiento para el cliente. */
export function customerConfirmationEmail(
  payload: EmailLeadPayload,
  locale: "es" | "en" = "es",
): { subject: string; html: string } {
  const isEs = locale === "es";
  const rows: Row[] = isEs
    ? [
        { label: "Folio", value: payload.referenceCode },
        { label: "Direccion", value: payload.address },
        { label: "Servicios", value: payload.serviceNames.join(", ") || "—" },
        {
          label: "Fecha solicitada",
          value: payload.requestedDate ? formatDate(payload.requestedDate) : "Por definir",
        },
        { label: "Metodo de pago", value: payload.paymentMethodLabel },
      ]
    : [
        { label: "Reference", value: payload.referenceCode },
        { label: "Address", value: payload.address },
        { label: "Services", value: payload.serviceNames.join(", ") || "—" },
        {
          label: "Requested date",
          value: payload.requestedDate ? formatDate(payload.requestedDate, "en-US") : "To be defined",
        },
        { label: "Payment method", value: payload.paymentMethodLabel },
      ];

  return {
    subject: isEs
      ? `Gracias por su solicitud ${payload.referenceCode} — Nieto Green Care LLC`
      : `Thank you for your request ${payload.referenceCode} — Nieto Green Care LLC`,
    html: shell(
      isEs ? "Gracias por su solicitud" : "Thank you for your request",
      isEs
        ? "Nieto Green Care LLC recibio su informacion correctamente."
        : "Nieto Green Care LLC received your information successfully.",
      `<p style="color:${COLORS.text};font-size:14px;line-height:22px;margin:0 0 18px;">
         ${
           isEs
             ? "Muchas gracias por requerir nuestros servicios, en un momento nos pondremos en contacto con usted."
             : "Thank you very much for requesting our services, we will contact you shortly."
         }
       </p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsToHtml(rows)}</table>
       <div style="margin-top:20px;padding:14px;border-radius:12px;background:rgba(120,53,15,0.18);border:1px solid rgba(201,162,39,0.3);color:${COLORS.goldSoft};font-size:12px;line-height:20px;">
         ${
           isEs
             ? "Advertencia / Nota: esta solicitud no constituye un cobro automatico ni una cita confirmada. Nieto Green Care revisara y confirmara la tarifa final y la fecha."
             : "Warning / Note: this request does not constitute an automatic charge or a confirmed appointment. Nieto Green Care will review and confirm the final rate and date."
         }
       </div>
       <p style="color:${COLORS.muted};font-size:12px;margin-top:18px;">
         ${isEs ? "Para consultas inmediatas llame al" : "For immediate questions call"}
         <a href="${BUSINESS.telHref}" style="color:${COLORS.goldSoft};">${BUSINESS.phoneDisplay}</a>.
       </p>`,
    ),
  };
}
