"use client";

import { useActionState } from "react";
import type { AccountState } from "@/server/auth/account-actions";
import styles from "./auth.module.css";

/**
 * "Şifremi unuttum" formu. Berber ve yönetici sayfaları aynı formu kullanır;
 * hangi hesap türü için çalışacağı dışarıdan verilen action ile belirlenir.
 */
export function ForgotForm({ action }: { action: (prev: AccountState, fd: FormData) => Promise<AccountState> }) {
  const [state, run, pending] = useActionState<AccountState, FormData>(action, {});
  if (state.done) {
    return (
      <div className={styles.done} role="status">
        <h2>{state.mode === "email" ? "E-postanızı kontrol edin" : "Talebiniz alındı"}</h2>
        {state.mode === "email" && (
          <p>
            Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı birkaç dakika içinde gelir. Bağlantı 60 dakika geçerlidir.
            Gelmediyse gereksiz (spam) klasörüne de bakın.
          </p>
        )}
        {state.mode === "admin" && (
          <p>
            Bu e-posta kayıtlıysa sizi kayıtlı cep telefonunuzdan arayıp yeni şifrenizi ileteceğiz. Güvenliğiniz için
            şifreler e-postayla gönderilmez.
          </p>
        )}
        {state.mode === "manual" && (
          <p>
            Yönetici şifresi bu sayfadan sıfırlanamıyor. Sunucuya erişiminiz olan bilgisayarda{" "}
            <code>npm run admin:create</code> komutunu çalıştırın; komut yeni bir şifre üretir.
          </p>
        )}
      </div>
    );
  }
  return (
    <form action={run} noValidate>
      <div className="field">
        <label htmlFor="f-email">Kayıtlı e-posta adresiniz</label>
        <input
          id="f-email"
          name="email"
          type="email"
          className="input"
          defaultValue={state.values?.email}
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="send"
          required
        />
      </div>
      <p className="form-error" role="alert">
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
      </button>
    </form>
  );
}
