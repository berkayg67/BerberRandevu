"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/app/admin/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
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
