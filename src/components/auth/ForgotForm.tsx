"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type SignupState } from "@/app/panel/actions";
import styles from "./auth.module.css";

export function ForgotForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(forgotPasswordAction, {});
  if (state.done) {
    return (
      <div className={styles.done} role="status">
        <h2>Talebiniz alındı</h2>
        <p>
          Bu e-posta kayıtlıysa sizi kayıtlı cep telefonunuzdan arayıp yeni şifrenizi ileteceğiz. Güvenliğiniz için
          şifreler e-postayla gönderilmez.
        </p>
      </div>
    );
  }
  return (
    <form action={action} noValidate>
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
        {pending ? "Gönderiliyor…" : "Yeni şifre iste"}
      </button>
    </form>
  );
}
