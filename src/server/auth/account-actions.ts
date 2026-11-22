"use server";

import { redirect } from "next/navigation";
import { currentSessionId, getCurrentUser, siteOrigin } from "@/server/auth/current";
import { forgotPassword, type ForgotMode } from "@/server/auth/forgot";
import { changePassword, consumeResetToken, updateAccount } from "@/server/auth/reset";
import { AccountError } from "@/server/auth/service";
import { getDb } from "@/server/db/client";

/** Şifre ve hesap formlarının ortak durumu (berber ve yönetici aynı formları kullanır). */
export type AccountState = {
  error?: string;
  ok?: string;
  done?: boolean;
  mode?: ForgotMode;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function fail(error: unknown, values?: Record<string, string>): AccountState {
  if (error instanceof AccountError) return { error: error.message, values };
  console.error("[hesap] beklenmeyen hata", error);
  return { error: "İşlem yapılamadı. Biraz sonra tekrar deneyin.", values };
}

/** "Şifremi unuttum". role: bağlanan sayfanın türü ("owner" berber, "admin" yönetici). */
export async function forgotAction(role: "owner" | "admin", _prev: AccountState, fd: FormData): Promise<AccountState> {
  const email = text(fd, "email");
  try {
    const { mode } = await forgotPassword(getDb(), { email, role, origin: await siteOrigin() });
    return { done: true, mode, values: { email } };
  } catch (error) {
    return fail(error, { email });
  }
}

/** E-postadaki bağlantıyla yeni şifre belirleme. Başarılı olunca giriş sayfasına gider. */
export async function resetAction(
  role: "owner" | "admin",
  token: string,
  _prev: AccountState,
  fd: FormData,
): Promise<AccountState> {
  const password = String(fd.get("password") ?? "");
  const again = String(fd.get("again") ?? "");
  if (password !== again) return { error: "İki şifre aynı değil." };
  try {
    await consumeResetToken(getDb(), { token, password, role });
  } catch (error) {
    return fail(error);
  }
  redirect(role === "admin" ? "/admin/giris?sifre=yenilendi" : "/panel/giris?sifre=yenilendi");
}

/** Giriş yapmış kullanıcının şifre değiştirmesi. Bu cihazdaki oturum açık kalır, diğerleri kapanır. */
export async function changePasswordAction(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("again") ?? "")) return { error: "İki yeni şifre aynı değil." };
  try {
    await changePassword(getDb(), {
      userId: user!.id,
      current: String(fd.get("current") ?? ""),
      next,
      keepSessionId: await currentSessionId(),
    });
    return { ok: "Şifreniz değişti. Diğer cihazlardaki oturumlar kapatıldı." };
  } catch (error) {
    return fail(error);
  }
}

/** Ad ve e-posta değiştirme (şifreyle doğrulanır). */
export async function updateAccountAction(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const values = { name: text(fd, "name"), email: text(fd, "email") };
  try {
    const r = await updateAccount(getDb(), {
      userId: user!.id,
      name: values.name,
      email: values.email,
      password: String(fd.get("password") ?? ""),
    });
    // Oturum çerezi kullanıcı kimliğine bağlı olduğundan e-posta değişse de açık kalır.
    return { ok: r.changedEmail ? "Kaydedildi. Bundan sonra yeni e-postanızla giriş yapın." : "Kaydedildi.", values: { name: r.name, email: r.email } };
  } catch (error) {
    return fail(error, values);
  }
}

