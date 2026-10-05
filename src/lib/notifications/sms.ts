/**
 * SMS directo al dueño sin proveedor externo: se envía un correo de texto por el SMTP
 * propio a la pasarela email-a-SMS de la operadora del dueño (p. ej. 7373144215@tmomail.net).
 * Si falta la configuración no se envía y se devuelve el motivo; nunca rompe la petición.
 */
export type SendSmsResult = { ok: boolean; provider: "smtp-gateway" | "none"; error?: string };

export async function sendSms(body: string): Promise<SendSmsResult & { target: string }> {
  const target = (process.env.OWNER_SMS_GATEWAY_EMAIL || "").trim();
  if (!target) return { ok: false, provider: "none", target, error: "Falta OWNER_SMS_GATEWAY_EMAIL" };
  if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
    return { ok: false, provider: "none", target, error: "Falta configuración SMTP" };
  }
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number.parseInt(process.env.SMTP_PORT ?? "465", 10),
      secure: (process.env.SMTP_SECURE ?? "true") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Nieto Green Care <${process.env.SMTP_USER}>`,
      to: target,
      subject: "Nueva cotización",
      text: body.slice(0, 300),
    });
    return { ok: true, provider: "smtp-gateway", target };
  } catch (error) {
    return { ok: false, provider: "smtp-gateway", target, error: error instanceof Error ? error.message : "Error de SMS" };
  }
}
