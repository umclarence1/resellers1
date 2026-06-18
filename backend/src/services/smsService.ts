import { env } from '../config/env';
import { normalizeGhanaPhone } from '../utils/phone';

export type CheckerSmsPayload = {
  type: string;
  serial: string;
  pin: string;
};

function buildCheckerMessage(payload: CheckerSmsPayload): string {
  return `Your ${payload.type} WAEC checker — Serial: ${payload.serial}, PIN: ${payload.pin}. Use at the WAEC results portal. — ${env.platformName}`;
}

/**
 * Generic SMS adapter — configure via SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID.
 * Supports common JSON POST shape: { to, message, sender } or Hubtel-style fields.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  const apiUrl = process.env.SMS_API_URL?.trim();
  const apiKey = process.env.SMS_API_KEY?.trim();
  const senderId = process.env.SMS_SENDER_ID?.trim() || env.platformName.slice(0, 11);

  if (!apiUrl || !apiKey) {
    console.log(`[SMS Dev] To: ${to} | ${message}`);
    return;
  }

  const phone = normalizeGhanaPhone(to).replace(/^0/, '233');

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      to: phone,
      recipient: phone,
      destination: phone,
      message,
      sender: senderId,
      sender_id: senderId,
      from: senderId,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SMS API ${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function sendCheckerSms(to: string, payload: CheckerSmsPayload): Promise<void> {
  await sendSms(to, buildCheckerMessage(payload));
}
