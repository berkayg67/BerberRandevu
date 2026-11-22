"use client";

import { useActionState } from "react";
import type { AccountState } from "@/server/auth/account-actions";

/** E-postadaki bağlantıyla yeni şifre belirleme formu. */
export function ResetForm({ action }: { action: (prev: AccountState, fd: FormData) => Promise<AccountState> }) {
  const [state, run, pending] = useActionState<AccountState, FormData>(action, {});
  return (
    <form action={run} noValidate>
      <div className="field">
        <label htmlFor="r-pass">
          Yeni şifre <span className="hint">en az 8 karakter</span>
        </label>
        <input id="r-pass" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="field">
        <label htmlFor="r-again">Yeni şifre (tekrar)</label>
        <input id="r-again" name="again" type="password" className="input" autoComplete="new-password" minLength={8} required />
      </div>
      <p className="form-error" role="alert">
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Şifreyi kaydet"}
      </button>
    </form>
  );
}
