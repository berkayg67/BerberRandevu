"use client";

import { useState, useTransition } from "react";
import {
  approveShopAction,
  dismissResetAction,
  rejectShopAction,
  resolveResetAction,
  type OwnerState,
} from "@/app/admin/actions";
import { Credentials } from "./OwnerAccounts";
import styles from "./admin.module.css";

type Pending = {
  id: string;
  name: string;
  district: string;
  address: string;
  ownerName: string | null;
  ownerPhone: string | null;
  email: string | null;
  createdAt: string;
};
type Reset = { id: string; name: string; email: string; shopName: string; ownerPhone: string | null; createdAt: string };

/** Onay bekleyen berber başvuruları. */
export function PendingShops({ items }: { items: Pending[] }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <section className={styles.requests} aria-labelledby="pending-h">
      <h2 id="pending-h" className={styles.h2}>
        Onay bekleyen başvurular <span className={styles.count}>{items.length}</span>
      </h2>
      <div className="group">
        {items.map((p) => (
          <div key={p.id} className={styles.requestRow}>
            <div className={styles.requestText}>
              <b>{p.name}</b>
              <span>
                {p.district}. {p.address}
              </span>
              <span>
                {p.ownerName}, {p.ownerPhone ? `0${p.ownerPhone}` : "telefon yok"}, {p.email}
              </span>
              <span className={styles.requestDate}>Başvuru: {p.createdAt}</span>
            </div>
            <div className={styles.requestActions}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => start(async () => setError((await approveShopAction(p.id)).error))}
              >
                Onayla
              </button>
              <button
                type="button"
                className={`${styles.linkButton} ${styles.danger}`}
                disabled={busy}
                onClick={() => {
                  if (!confirm(`${p.name} başvurusu silinsin mi? Bu geri alınamaz.`)) return;
                  start(async () => setError((await rejectShopAction(p.id)).error));
                }}
              >
                Reddet
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

/** "Şifremi unuttum" talepleri: yeni şifre üretilir ve berber aranarak iletilir. */
export function ResetRequests({ items }: { items: Reset[] }) {
  const [busy, start] = useTransition();
  const [result, setResult] = useState<OwnerState | null>(null);
  if (items.length === 0 && !result) return null;
  return (
    <section className={styles.requests} aria-labelledby="reset-h">
      <h2 id="reset-h" className={styles.h2}>
        Şifre talepleri <span className={styles.count}>{items.length}</span>
      </h2>
      {items.length > 0 && (
        <div className="group">
          {items.map((r) => (
            <div key={r.id} className={styles.requestRow}>
              <div className={styles.requestText}>
                <b>{r.shopName}</b>
                <span>
                  {r.name}, {r.email}
                </span>
                <span>Aranacak numara: {r.ownerPhone ? `0${r.ownerPhone}` : "kayıtlı değil"}</span>
                <span className={styles.requestDate}>Talep: {r.createdAt}</span>
              </div>
              <div className={styles.requestActions}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => start(async () => setResult(await resolveResetAction(r.id)))}
                >
                  Yeni şifre üret
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={busy}
                  onClick={() => start(() => dismissResetAction(r.id))}
                >
                  Kapat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {result?.credentials && <Credentials c={result.credentials} />}
      {result?.error && <p className="form-error">{result.error}</p>}
    </section>
  );
}
