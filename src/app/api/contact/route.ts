import { NextResponse } from "next/server";

import { BUSINESS } from "@/lib/constants";
import { sendEmail } from "@/lib/notifications/email";
import { contactMessageSchema, formatZodErrors } from "@/lib/validation";
import { formatPhone } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * POST /api/contact
 * Mensajes rapidos del boton flotante. El servidor notifica al dueño únicamente
 * por correo; el SMS se abre de forma nativa desde el navegador del cliente.
 */
export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Datos invalidos." },
      { status: 400 },
    );
  }

  const parsed = contactMessageSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Revise los campos marcados antes de continuar.",
        errors: formatZodErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const channelLabel =
    data.preferredChannel === "sms" ? "SMS (mensaje de texto)" : "Correo electronico";

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#E5E7EB;background:#0B1120;padding:22px;border-radius:16px;border:1px solid rgba(201,162,39,0.3);">
      <p style="margin:0 0 4px;color:#EBD79A;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Nieto Green Care LLC</p>
      <h2 style="margin:0 0 14px;color:#fff;font-family:Georgia,serif;font-size:22px;">Nuevo mensaje del sitio web</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#9CA3AF;">Cliente</td><td style="color:#fff;font-weight:600;">${escapeHtml(data.name)}</td></tr>
        <tr><td style="padding:6px 0;color:#9CA3AF;">Telefono</td><td style="color:#fff;font-weight:600;">${escapeHtml(formatPhone(data.phone))}</td></tr>
        <tr><td style="padding:6px 0;color:#9CA3AF;">Correo</td><td style="color:#fff;font-weight:600;">${escapeHtml(data.email || "—")}</td></tr>
        <tr><td style="padding:6px 0;color:#9CA3AF;">Respuesta preferida</td><td style="color:#fff;font-weight:600;">${escapeHtml(channelLabel)}</td></tr>
      </table>
      <div style="margin-top:14px;padding:14px;border-radius:12px;background:rgba(22,101,52,0.18);border:1px solid rgba(201,162,39,0.25);color:#E5E7EB;font-size:14px;line-height:22px;">
        ${escapeHtml(data.message).replace(/\n/g, "<br />")}
      </div>
      <p style="color:#9CA3AF;font-size:12px;margin-top:16px;">
        Responda al cliente por ${escapeHtml(channelLabel)}. Tel. del negocio: ${escapeHtml(BUSINESS.phoneDisplay)}
      </p>
    </div>`;

  const emailResult = await sendEmail({
    to: process.env.EMAIL_TO || BUSINESS.email,
    subject: `Mensaje web de ${data.name} (${formatPhone(data.phone)})`,
    html,
    replyTo: data.email || undefined,
  });

  if (!emailResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No pudimos enviar el mensaje. Intente de nuevo o llamenos al " + BUSINESS.phoneDisplay,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      emailSent: emailResult.ok,
      preferredChannel: data.preferredChannel,
    },
  });
}