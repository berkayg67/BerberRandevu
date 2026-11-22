/**
 * E-posta gönderimi. Resend (resend.com) REST API'si kullanılır; ek paket gerekmez.
 *
 * Ortam değişkenleri:
 *   RESEND_API_KEY  Resend hesabından alınan anahtar
 *   MAIL_FROM       Gönderen, alan adı Resend'de doğrulanmış olmalı. Örnek: Tıraş Vakti <bildirim@alanadi.com>
 *
 * Anahtar yoksa gönderim yapılmaz; çağıran taraf buna göre yedek yol izler.
 */
export type Mail = { to: string; subject: string; text: string; html?: string };
export type MailResult = { sent: true } | { sent: false; reason: "not_configured" | "failed" };

type Fetch = typeof fetch;
type Env = Record<string, string | undefined>;

export function mailConfigured(env: Env = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}

export async function sendMail(mail: Mail, deps: { env?: Env; fetch?: Fetch } = {}): Promise<MailResult> {
  const env = deps.env ?? process.env;
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return { sent: false, reason: "not_configured" };
  try {
    const res = await (deps.fetch ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[e-posta] gönderilemedi", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (error) {
    console.error("[e-posta] gönderilemedi", error);
    return { sent: false, reason: "failed" };
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Şifre sıfırlama e-postası (sade metin ve basit HTML). */
export function resetMail(input: { to: string; name: string; link: string; minutes: number }): Mail {
  const first = input.name.split(" ")[0] || "Merhaba";
  const text = [
    `Merhaba ${first},`,
    "",
    "Tıraş Vakti hesabınız için şifre sıfırlama isteği aldık. Yeni şifre belirlemek için bu bağlantıyı açın:",
    "",
    input.link,
    "",
    `Bağlantı ${input.minutes} dakika geçerlidir ve yalnızca bir kez kullanılabilir.`,
    "Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.",
    "",
    "Tıraş Vakti",
  ].join("\n");
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#10131f">
<p style="font-size:16px">Merhaba ${esc(first)},</p>
<p style="font-size:16px;line-height:1.5">Tıraş Vakti hesabınız için şifre sıfırlama isteği aldık. Yeni şifre belirlemek için aşağıdaki düğmeye basın.</p>
<p style="margin:24px 0"><a href="${esc(input.link)}" style="background:#2447d6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Yeni şifre belirle</a></p>
<p style="font-size:14px;color:#586079;line-height:1.5">Bağlantı ${input.minutes} dakika geçerlidir ve yalnızca bir kez kullanılabilir. Düğme çalışmazsa şu adresi tarayıcınıza yapıştırın:<br><span style="word-break:break-all">${esc(input.link)}</span></p>
<p style="font-size:14px;color:#586079;line-height:1.5">Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.</p>
</div>`;
  return { to: input.to, subject: "Tıraş Vakti şifre sıfırlama", text, html };
}
