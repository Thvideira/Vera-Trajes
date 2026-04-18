import { env } from "../config/env.js";

/** Formato E.164 sem + para a API (ex: 5511999998888) */
export function normalizeWhatsappPhone(telefone: string): string {
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) return digits;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

interface SendTextResult {
  ok: boolean;
  error?: string;
}

export async function sendWhatsappText(
  toE164Digits: string,
  body: string
): Promise<SendTextResult> {
  const token = env.WHATSAPP_TOKEN;
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.warn("[WhatsApp] WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados");
    return { ok: false, error: "WhatsApp não configurado" };
  }

  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toE164Digits,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = JSON.stringify(json);
    console.error("[WhatsApp] Falha:", err);
    return { ok: false, error: err };
  }
  return { ok: true };
}
