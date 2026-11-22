"use client";

import { useActionState } from "react";
import { blockAction, type PanelFormState } from "@/app/panel/actions";
import styles from "./panel.module.css";

/**
 * Engelleme formu. Bir müşterinin sayfasından açılınca isim ve telefon hazır
 * gelir (gizli alan); listedeki "kişi engelle" formunda elle yazılır.
 */
export function BlockForm({ name, phone }: { name?: string; phone?: string }) {
  const [state, action, pending] = useActionState<PanelFormState, FormData>(blockAction, {});
  const fixed = name !== undefined || phone !== undefined;
  return (
    <form action={action} className={styles.blockCard} noValidate>
      {fixed ? (
        <>
          <input type="hidden" name="name" value={name ?? ""} />
          <input type="hidden" name="phone" value={phone ?? ""} />
        </>
      ) : (
        <div className={styles.row2}>
          <div className="field">
            <label htmlFor="k-name">
              Ad soyad <span className="hint">isteğe bağlı</span>
            </label>
            <input id="k-name" name="name" className="input" defaultValue={state.values?.name ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="k-phone">
              Telefon <span className="hint">isteğe bağlı</span>
            </label>
            <input id="k-phone" name="phone" type="tel" inputMode="tel" className="input" placeholder="05XX XXX XX XX" defaultValue={state.values?.phone ?? ""} />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="k-note">
          Not <span className="hint">sadece siz görürsünüz</span>
        </label>
        <input id="k-note" name="note" className="input" placeholder="Örnek: üç kez haber vermeden gelmedi" defaultValue={state.values?.note ?? ""} />
      </div>
      <p className="form-error" role="alert">
        {state.error}
      </p>
      {state.ok && <p className={styles.okText} style={{ marginTop: 0, marginBottom: 12 }}>{state.ok}</p>}
      <button type="submit" className="btn btn-danger" disabled={pending} style={{ marginBottom: 12 }}>
        {pending ? "Engelleniyor…" : "Engelle"}
      </button>
    </form>
  );
}
