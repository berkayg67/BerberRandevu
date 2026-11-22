"use client";

import { useActionState } from "react";
import { changePasswordAction, updateAccountAction, type AccountState } from "@/server/auth/account-actions";
import panel from "@/components/panel/panel.module.css";

function Notice({ state, pending }: { state: AccountState; pending: boolean }) {
  return (
    <>
      {!pending && state.ok && (
        <span className={panel.okInline} role="status">
          {state.ok}
        </span>
      )}
      {!pending && state.error && (
        <span className="form-error" role="alert">
          {state.error}
        </span>
      )}
    </>
  );
}

/** Şifre değiştirme: berber ve yönetici ayarlarında aynı form. */
export function ChangePasswordForm() {
  const [state, run, pending] = useActionState<AccountState, FormData>(changePasswordAction, {});
  return (
    <form action={run} className={panel.card} noValidate key={state.ok ? "done" : "form"}>
      <div style={{ paddingTop: 12 }}>
        <div className="field">
          <label htmlFor="pw-current">Mevcut şifre</label>
          <input id="pw-current" name="current" type="password" className="input" autoComplete="current-password" required />
        </div>
        <div className="field">
          <label htmlFor="pw-next">
            Yeni şifre <span className="hint">en az 8 karakter</span>
          </label>
          <input id="pw-next" name="next" type="password" className="input" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="pw-again">Yeni şifre (tekrar)</label>
          <input id="pw-again" name="again" type="password" className="input" autoComplete="new-password" minLength={8} required />
        </div>
      </div>
      <div className={panel.saveRow}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Şifreyi değiştir"}
        </button>
        <Notice state={state} pending={pending} />
      </div>
    </form>
  );
}

/** Ad ve e-posta değiştirme; şifre ile doğrulanır. */
export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, run, pending] = useActionState<AccountState, FormData>(updateAccountAction, {});
  return (
    <form action={run} className={panel.card} noValidate>
      <div style={{ paddingTop: 12 }}>
        <div className="field">
          <label htmlFor="ac-name">Adınız</label>
          <input id="ac-name" name="name" className="input" defaultValue={state.values?.name ?? name} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="ac-email">
            E-posta <span className="hint">giriş ve şifre sıfırlama için</span>
          </label>
          <input id="ac-email" name="email" type="email" className="input" defaultValue={state.values?.email ?? email} autoComplete="email" autoCapitalize="none" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ac-pass">
            Şifreniz <span className="hint">değişikliği onaylamak için</span>
          </label>
          <input id="ac-pass" name="password" type="password" className="input" autoComplete="current-password" required />
        </div>
      </div>
      <div className={panel.saveRow}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <Notice state={state} pending={pending} />
      </div>
    </form>
  );
}
