import { Resend } from "resend";

/**
 * Envio de correo electronico con Resend (preferido) o Nodemailer/SMTP (alternativo).
 * Ningun envio rompe la peticion: los errores se devuelven como resultado.
 */

export type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType?: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult = {
  ok: boolean;
  provider: "resend" | "smtp" | "none";
  error?: string;
  id?: string;
};

const fromAddress = () =>
  process.env.EMAIL_FROM || "Nieto Green Care <onboarding@resend.dev>";

const replyToAddress = () => process.env.EMAIL_REPLY_TO || process.env.EMAIL_TO || undefined;

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER),
  );
}

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const validRecipients = recipients.map((email) => email.trim()).filter(Boolean);

  if (validRecipients.length === 0) {
    return { ok: false, provider: "none", error: "No hay destinatarios de correo." };
  }

  const resend = getResend();

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromAddress(),
        to: validRecipients,
        subject: input.subject,
        html: input.html,
        replyTo: input.replyTo || replyToAddress(),
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
        })),
      });

      if (error) {
        return { ok: false, provider: "resend", error: error.message };
      }

      return { ok: true, provider: "resend", id: data?.id };
    } catch (error) {
      return {
        ok: false,
        provider: "resend",
        error: error instanceof Error ? error.message : "Error al enviar con Resend.",
      };
    }
  }

  // Fallback SMTP con Nodemailer
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const { default: nodemailer } = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number.parseInt(process.env.SMTP_PORT ?? "465", 10),
        secure: (process.env.SMTP_SECURE ?? "true") === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      const info = await transporter.sendMail({
        from: fromAddress(),
        to: validRecipients.join(", "),
        subject: input.subject,
        html: input.html,
        replyTo: input.replyTo || replyToAddress(),
        attachments: input.attachments,
      });

      return { ok: true, provider: "smtp", id: info.messageId };
    } catch (error) {
      return {
        ok: false,
        provider: "smtp",
        error: error instanceof Error ? error.message : "Error al enviar por SMTP.",
      };
    }
  }

  return {
    ok: false,
    provider: "none",
    error:
      "Correo no configurado. Defina RESEND_API_KEY o las variables SMTP_* en .env.local.",
  };
}