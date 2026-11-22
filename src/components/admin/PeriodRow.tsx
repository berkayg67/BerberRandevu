"use client";

import { useActionState, useState, useTransition } from "react";
import { markPaidAction, undoPaymentAction, type FormState } from "@/app/admin/actions";
import styles from "./admin.module.css";

type Props = {
  shopId: string;
  period: string;
  label: string;
  isCurrent: boolean;
  defaultAmount: string;
  paid: { text: string } | null;
};

/** Bir ayın tahsilat satırı: ödenmediyse "Tahsil edildi" formu, ödendiyse ayrıntı ve geri alma. */
export function PeriodRow({ shopId, period, label, isCurrent, defaultAmount, paid }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoing, startUndo] = useTransition();
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, fd) => {
      const result = await markPaidAction(shopId, period, prev, fd);
      if (result.ok) setOpen(false);
      return result;
    },
    {},
  );

  return (
    <div className={styles.periodRow}>
      <div className={styles.periodTop}>
        <span className={styles.periodName}>
          {label}
          {isCurrent && <span className="tag tag-grey">Bu ay</span>}
          {paid ? <span className="tag tag-green">Ödendi</span> : <span className="tag tag-yellow">Bekliyor</span>}
        </span>
        {paid ? (
          confirmUndo ? (
            <span>
              <button
                type="button"
                className={`${styles.linkButton} ${styles.danger}`}
                disabled={undoing}
                onClick={() => startUndo(() => undoPaymentAction(shopId, period))}
              >
                {undoing ? "Geri alınıyor…" : "Evet, geri al"}
              </button>
              <button type="button" className={styles.linkButton} onClick={() => setConfirmUndo(false)}>
                Vazgeç
              </button>
            </span>
          ) : (
            <button type="button" className={styles.linkButton} onClick={() => setConfirmUndo(true)}>
              Geri al
            </button>
          )
        ) : (
          !open && (
            <button type="button" className={`btn btn-quiet ${styles.small}`} onClick={() => setOpen(true)}>
              Tahsil edildi
            </button>
          )
        )}
      </div>

      {paid && <p className={styles.periodInfo}>{paid.text}</p>}

      {!paid && open && (
        <form action={action} className={styles.payForm} noValidate>
          <input
            name="amount"
            className={`input ${styles.smallInput}`}
            defaultValue={state.values?.amount ?? defaultAmount}
            inputMode="decimal"
            aria-label={`${label} tutarı (₺)`}
          />
          <select name="method" className={`select ${styles.smallInput}`} defaultValue={state.values?.method ?? "nakit"} aria-label="Ödeme yöntemi">
            <option value="nakit">Nakit</option>
            <option value="havale">Havale / EFT</option>
            <option value="kart">Kart</option>
            <option value="diger">Diğer</option>
          </select>
          <input name="note" className={`input ${styles.smallInput}`} placeholder="Not (isteğe bağlı)" aria-label="Not" defaultValue={state.values?.note ?? ""} />
          <span style={{ display: "flex", gap: 8 }}>
            <button type="submit" className={`btn btn-primary ${styles.small}`} disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button type="button" className={styles.linkButton} onClick={() => setOpen(false)}>
              Vazgeç
            </button>
          </span>
          {state.error && (
            <p className="form-error" role="alert" style={{ gridColumn: "1 / -1" }}>
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
