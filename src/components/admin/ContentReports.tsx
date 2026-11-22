"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { resolveReportAction } from "@/app/admin/actions";
import styles from "./admin.module.css";

type Report = {
  id: string;
  createdAt: string;
  target: string;
  reasonLabel: string;
  details: string;
  contact: string | null;
  shopId: string | null;
  shopName: string | null;
};

/** İçerik bildirimleri (5651 yer sağlayıcı yükümlülüğü): incele, gerekirse fotoğrafları kaldır, kararı yaz. */
export function ContentReports({ items }: { items: Report[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [removeGallery, setRemoveGallery] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  if (items.length === 0) return null;
  return (
    <section className={styles.requests} aria-labelledby="reports-h">
      <h2 id="reports-h" className={styles.h2}>
        İçerik bildirimleri <span className={styles.count}>{items.length}</span>
      </h2>
      <div className="group">
        {items.map((r) => (
          <div key={r.id} className={styles.requestRow} style={{ display: "grid", gap: 8 }}>
            <div className={styles.requestText}>
              <b>{r.reasonLabel}</b>
              <span>
                {r.createdAt}. Bildirilen: {r.target}
                {r.shopId && r.shopName && (
                  <>
                    {" "}
                    (<Link href={`/admin/dukkanlar/${r.shopId}`}>{r.shopName}</Link>)
                  </>
                )}
              </span>
              <span>{r.details}</span>
              {r.contact && <span>İletişim: {r.contact}</span>}
            </div>
            {openId === r.id ? (
              <div>
                <div className="field">
                  <label htmlFor={`res-${r.id}`}>Kararınız</label>
                  <input id={`res-${r.id}`} className="input" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Örn. Fotoğraf kaldırıldı, berbere bildirildi" />
                </div>
                {r.shopId && (
                  <label className={styles.checkLine}>
                    <input type="checkbox" checked={removeGallery} onChange={(e) => setRemoveGallery(e.target.checked)} />
                    Dükkânın galeri fotoğraflarını kaldır
                  </label>
                )}
                <p className="form-error" role="alert">
                  {error}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const res = await resolveReportAction(r.id, { resolution, removeGallery });
                        if (res.error) setError(res.error);
                        else {
                          setOpenId(null);
                          setResolution("");
                          setRemoveGallery(false);
                        }
                      })
                    }
                  >
                    Sonuçlandır
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => setOpenId(null)}>
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    setOpenId(r.id);
                    setError(undefined);
                  }}
                >
                  İncele ve sonuçlandır
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
