"use client";

import { useTransition } from "react";
import { addClosureAction, removeClosureAction } from "@/app/panel/actions";
import { SaveForm } from "./SaveForm";
import styles from "./panel.module.css";

type Closure = { id: string; startsOn: string; endsOn: string; note: string | null };

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short", timeZone: "UTC" });

/** Tatil ve izin günleri: bu günlerde online randevu kapanır, siz telefonla yine de randevu ekleyebilirsiniz. */
export function Closures({ closures, today }: { closures: Closure[]; today: string }) {
  const [pending, start] = useTransition();
  return (
    <div className={styles.card}>
      {closures.length === 0 && <p className={styles.sub} style={{ padding: "12px 0 0" }}>Planlı tatil yok.</p>}
      {closures.map((c) => (
        <div key={c.id} className={styles.setRow}>
          <span className={styles.lb}>
            {c.startsOn === c.endsOn ? fmt(c.startsOn) : `${fmt(c.startsOn)} – ${fmt(c.endsOn)}`}
            {c.note && <small>{c.note}</small>}
          </span>
          <button type="button" className={styles.linkDanger} disabled={pending} onClick={() => start(() => removeClosureAction(c.id))}>
            Kaldır
          </button>
        </div>
      ))}
      <SaveForm action={addClosureAction} submitLabel="Tatili ekle">
        <div style={{ paddingTop: 12 }}>
          <div className={styles.row2}>
            <div className="field">
              <label htmlFor="cl-from">Başlangıç</label>
              <input id="cl-from" name="from" type="date" className="input" min={today} defaultValue={today} required />
            </div>
            <div className="field">
              <label htmlFor="cl-to">
                Bitiş <span className="hint">tek gün için boş bırakın</span>
              </label>
              <input id="cl-to" name="to" type="date" className="input" min={today} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="cl-note">Not</label>
            <input id="cl-note" name="note" className="input" maxLength={80} placeholder="Örn. Bayram tatili" />
          </div>
          <label className={styles.checkLine}>
            <input type="checkbox" name="cancel" className={styles.check} />
            Bu günlerdeki mevcut randevuları iptal et ve müşterilere haber ver
          </label>
        </div>
      </SaveForm>
    </div>
  );
}
