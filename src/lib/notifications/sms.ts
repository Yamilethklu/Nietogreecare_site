/**
 * SMS al dueño con Twilio (opcional). Si faltan las variables de entorno no se envía
 * y se devuelve el motivo; nunca rompe la petición.
 */
export type SendSmsResult = { ok: boolean; provider: "twilio" | "none"; error?: string };

export function isSmsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { ok: false, provider: "none", error: "SMS no configurado (TWILIO_*)" };
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 600) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, provider: "twilio", error: `Twilio ${response.status}` };
    return { ok: true, provider: "twilio" };
  } catch (error) {
    return { ok: false, provider: "twilio", error: error instanceof Error ? error.message : "Error de SMS" };
  }
}
