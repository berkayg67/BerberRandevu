"use client";

import { useActionState, useState, useTransition } from "react";
import { createOwnerAction, resetOwnerAction, setOwnerActiveAction, type OwnerState } from "@/app/admin/actions";
import styles from "./admin.module.css";

type Owner = { id: string; email: string; name: string; active: boolean; lastLogin: string | null };

/** Yeni şifre yalnızca bir kez gösterilir; kopyalanıp berbere iletilir. */
export function Credentials({ c }: { c: { email: string; password: string } }) {
  const [copied, setCopied] = useState(false);
  const text = `Tıraş Vakti berber paneli\nAdres: ${location.origin}/panel\nE-posta: ${c.email}\nŞifre: ${c.password}`;
  return (
    <div className="callout" style={{ marginTop: 12, borderColor: "var(--enamel)" }}>
      <b style={{ color: "var(--ink)" }}>Giriş bilgileri (bir daha gösterilmeyecek)</b>
      <pre style={{ whiteSpace: "pre-wrap", font: "500 15px/1.5 var(--f-body)", color: "var(--ink)", margin: "8px 0" }}>{text}</pre>
      <button
        type="button"
        className={`btn btn-quiet ${styles.small}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            /* kopyalanamazsa elle seçilebilir */
          }
        }}
      >
        {copied ? "Kopyalandı" : "Kopyala"}
      </button>
    </div>
  );
}

export function OwnerAccounts({ shopId, owners }: { shopId: string; owners: Owner[] }) {
  const [state, action, pending] = useActionState<OwnerState, FormData>(createOwnerAction.bind(null, shopId), {});
  const [reset, setReset] = useState<OwnerState | null>(null);
  const [busy, start] = useTransition();

  return (
    <>
      {owners.length > 0 && (
        <div className="group" style={{ marginBottom: 12 }}>
          {owners.map((o) => (
            <div key={o.id} className={styles.periodRow}>
              <div className={styles.periodTop}>
                <span className={styles.periodName}>
                  {o.name}
                  {o.active ? <span className="tag tag-green">Açık</span> : <span className="tag tag-grey">Kapalı</span>}
                </span>
                <span>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={busy}
                    onClick={() => start(async () => setReset(await resetOwnerAction(shopId, o.id)))}
                  >
                    Şifre yenile
                  </button>
                  <button
                    type="button"
                    className={`${styles.linkButton} ${o.active ? styles.danger : ""}`}
                    disabled={busy}
                    onClick={() => start(() => setOwnerActiveAction(shopId, o.id, !o.active))}
                  >
                    {o.active ? "Kapat" : "Aç"}
                  </button>
                </span>
              </div>
              <p className={styles.periodInfo}>
                {o.email}. {o.lastLogin ? `Son giriş: ${o.lastLogin}` : "Henüz giriş yapmadı"}
              </p>
            </div>
          ))}
        </div>
      )}
      {reset?.credentials && <Credentials c={reset.credentials} />}
      {reset?.error && <p className="form-error">{reset.error}</p>}

      <form action={action} className={styles.card} noValidate style={{ marginTop: 12 }}>
        <div className={styles.formGrid}>
          <div className="field">
            <label htmlFor="o-name">Hesap sahibi</label>
            <input id="o-name" name="name" className="input" placeholder="Murat Dursun" />
          </div>
          <div className="field">
            <label htmlFor="o-email">E-posta</label>
            <input id="o-email" name="email" type="email" className="input" placeholder="murat@ornek.com" />
          </div>
        </div>
        <p className="form-error" role="alert">
          {state.error}
        </p>
        <div className={styles.formFoot}>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Açılıyor…" : "Berber hesabı aç"}
          </button>
        </div>
      </form>
      {state.credentials && <Credentials c={state.credentials} />}
    </>
  );
}
