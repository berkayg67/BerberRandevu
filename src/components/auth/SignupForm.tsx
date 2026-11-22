"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type SignupState } from "@/app/panel/actions";
import styles from "./auth.module.css";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const v = state.values ?? {};

  if (state.done) {
    return (
      <div className={styles.done} role="status">
        <h2>Başvurunuz alındı</h2>
        <p>Bilgilerinizi kontrol edip kısa süre içinde onaylayacağız. Onaylandığında sizi telefonla arayacağız.</p>
        <p>
          Onaydan sonra <b>{v.email}</b> ve belirlediğiniz şifreyle giriş yapabilirsiniz.
        </p>
      </div>
    );
  }

  // key: hata sonrası form yeniden çizilir, yazılanlar defaultValue ile geri gelir.
  return (
    <form action={action} noValidate key={JSON.stringify(v)}>
      <h2 className={styles.section}>Dükkân</h2>
      <div className="field">
        <label htmlFor="s-shop">Dükkân adı</label>
        <input id="s-shop" name="shopName" className="input" defaultValue={v.shopName} autoComplete="organization" autoCapitalize="words" required />
      </div>
      <div className="field">
        <label htmlFor="s-district">İlçe</label>
        <input id="s-district" name="district" className="input" defaultValue={v.district} autoCapitalize="words" required />
      </div>
      <div className="field">
        <label htmlFor="s-address">Açık adres</label>
        <textarea id="s-address" name="address" className="input" rows={2} defaultValue={v.address} autoComplete="street-address" required />
      </div>

      <h2 className={styles.section}>Hesap</h2>
      <div className={styles.row2}>
        <div className="field">
          <label htmlFor="s-name">Adınız soyadınız</label>
          <input id="s-name" name="ownerName" className="input" defaultValue={v.ownerName} autoComplete="name" autoCapitalize="words" required />
        </div>
        <div className="field">
          <label htmlFor="s-phone">Cep telefonu</label>
          <input id="s-phone" name="phone" type="tel" inputMode="tel" className="input" placeholder="05XX XXX XX XX" defaultValue={v.phone} autoComplete="tel" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="s-email">E-posta</label>
        <input id="s-email" name="email" type="email" className="input" defaultValue={v.email} autoComplete="email" autoCapitalize="none" autoCorrect="off" required />
      </div>
      <div className="field">
        <label htmlFor="s-pass">Şifre</label>
        <input id="s-pass" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required />
        <p className={styles.hint}>En az 8 karakter.</p>
      </div>

      <label className={styles.check}>
        <input type="checkbox" name="terms" />
        <span>
          <Link href="/yasal/kullanim-kosullari" target="_blank">Kullanım koşullarını</Link> okudum ve kabul ediyorum.
        </span>
      </label>
      <p className={styles.hint}>
        Kişisel verilerinizin nasıl işlendiğini{" "}
        <Link href="/yasal/berber-aydinlatma" target="_blank">
          berber aydınlatma metninde
        </Link>{" "}
        okuyabilirsiniz.
      </p>

      <p className="form-error" role="alert">
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Gönderiliyor…" : "Başvuruyu gönder"}
      </button>
    </form>
  );
}
