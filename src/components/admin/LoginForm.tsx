"use client";

import Link from "next/link";
import { useActionState } from "react";
import auth from "@/components/auth/auth.module.css";

type State = { error?: string; values?: Record<string, string> };

/** Yönetici ve berber girişinin ortak formu; hangi işlemin çağrılacağı dışarıdan verilir. */
export function LoginForm({
  login,
  forgotHref,
}: {
  login: (prev: State, fd: FormData) => Promise<State>;
  /** Verilirse şifre alanının yanında "Şifremi unuttum" bağlantısı çıkar. */
  forgotHref?: string;
}) {
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
        <div className={auth.labelRow}>
          <label htmlFor="password">Şifre</label>
          {forgotHref && <Link href={forgotHref}>Şifremi unuttum</Link>}
        </div>
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
