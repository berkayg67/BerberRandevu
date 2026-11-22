import type { Db } from "@/server/db/types";
import { mailConfigured, resetMail, sendMail, type Mail, type MailResult } from "@/server/mail/send";
import { requestPasswordReset } from "@/server/signup/service";
import { RESET_MINUTES, createResetToken } from "./reset";
import { AccountError } from "./service";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "email": bağlantı e-postayla gider. "admin": e-posta yok, yönetici yeni şifre üretip iletir. "manual": yönetici hesabı, komutla yenilenir. */
export type ForgotMode = "email" | "admin" | "manual";

/**
 * "Şifremi unuttum". Dışarıya hesap olup olmadığı belli olmaz: yanıt yalnızca sistemin
 * e-posta ayarına bağlıdır, kullanıcıya değil.
 */
export async function forgotPassword(
  db: Db,
  input: {
    email: string;
    role: "admin" | "owner";
    /** Sitenin adresi, örn. https://alanadi.com (sonunda eğik çizgi olmadan). */
    origin: string;
  },
  deps: { send?: (mail: Mail) => Promise<MailResult>; mailReady?: boolean; now?: Date } = {},
): Promise<{ mode: ForgotMode }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new AccountError("Geçerli bir e-posta adresi yazın.");
  const ready = deps.mailReady ?? mailConfigured();
  const send = deps.send ?? sendMail;

  if (ready) {
    const made = await createResetToken(db, { email, role: input.role }, deps.now);
    if (made) {
      const path = input.role === "admin" ? "/admin/sifre-sifirla" : "/panel/sifre-sifirla";
      const result = await send(
        resetMail({
          to: made.user.email,
          name: made.user.name,
          link: `${input.origin}${path}?token=${made.token}`,
          minutes: RESET_MINUTES,
        }),
      );
      // E-posta gönderilemediyse berber takılı kalmasın: yöneticiye talep düşer.
      if (!result.sent && input.role === "owner") await requestPasswordReset(db, email);
    }
    return { mode: "email" };
  }

  if (input.role === "owner") {
    await requestPasswordReset(db, email);
    return { mode: "admin" };
  }
  // Yönetici hesabı için yedek yol yok; kullanıcıya komut gösterilir.
  return { mode: "manual" };
}
