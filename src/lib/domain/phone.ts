/**
 * Türkiye cep telefonu numaraları.
 * Veritabanında başında 0 olmadan 10 hane saklanır: 5XXXXXXXXX.
 */

/** "0532 123 45 67", "+90 532 123 4567", "5321234567" → "5321234567"; geçersizse null. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return /^5\d{9}$/.test(digits) ? digits : null;
}

/** "5321234567" → "0532 123 45 67" */
export function formatPhone(phone: string): string {
  return `0${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 8)} ${phone.slice(8)}`;
}

/** WhatsApp için ülke koduyla: "5321234567" → "905321234567" */
export function toWhatsAppNumber(phone: string): string {
  return `90${phone}`;
}
