"use client";

import { useActionState } from "react";

type State = { error?: string; values?: Record<string, string> };

/** Yönetici ve berber girişinin ortak formu; hangi işlemin çağrılacağı dışarıdan verilir. */
export function LoginForm({ login }: { login: (prev: State, fd: FormData) => Promise<State> }) {
  const [state, action, pending] = useActionState<State, FormData>(login, {});
  return (
    <form action={action} noValidate>
      <div className="field">
        <label htmlFor="email">E-posta</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          className="input"
          defaultValue={state.values?.email ?? ""}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Şifre</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="input" required />
      </div>
      <p className="form-error" role="alert">
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
