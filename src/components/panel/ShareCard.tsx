"use client";

import { useState } from "react";
import { changeSlugAction } from "@/app/panel/actions";
import { SaveForm } from "./SaveForm";
import styles from "./panel.module.css";

/** Müşteri sayfasının adresi: kopyala, WhatsApp'ta paylaş, QR kod, adresi değiştir. */
export function ShareCard({ origin, slug, qrSvg, shopName }: { origin: string; slug: string; qrSvg: string; shopName: string }) {
  const url = `${origin}/${slug}`;
  const [copied, setCopied] = useState(false);
  const host = origin.replace(/^https?:\/\//, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Bağlantıyı kopyalayın", url);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.shareBody}>
        <div>
          <p className={styles.shareLabel}>Randevu sayfanız</p>
          <p className={styles.shareUrl}>
            {host}/<b>{slug}</b>
          </p>
          <div className={styles.shareBtns}>
            <button type="button" className="btn btn-primary" onClick={copy}>
              {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
            </button>
            <a
              className="btn btn-wa"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`${shopName} için online randevu: ${url}`)}`}
            >
              WhatsApp&apos;ta paylaş
            </a>
            <a className="btn btn-quiet" href={url} target="_blank" rel="noopener noreferrer">
              Sayfayı aç
            </a>
          </div>
        </div>
        <figure className={styles.qr}>
          <div dangerouslySetInnerHTML={{ __html: qrSvg }} role="img" aria-label={`${url} adresinin QR kodu`} />
          <figcaption>Vitrine ya da kartvizite koyun: müşteri okutup randevu alır.</figcaption>
        </figure>
      </div>
      <SaveForm action={changeSlugAction}>
        <div style={{ paddingTop: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="slug">
              Adres <span className="hint">harf, rakam ve tire; 3-40 karakter</span>
            </label>
            <div className={styles.slugRow}>
              <span>{host}/</span>
              <input id="slug" name="slug" className="input" defaultValue={slug} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </div>
            <p className={styles.hintLine}>Adresi değiştirirseniz eski bağlantılar yeni adrese yönlenir; paylaşılmış bağlantılar bozulmaz.</p>
          </div>
        </div>
      </SaveForm>
    </div>
  );
}
