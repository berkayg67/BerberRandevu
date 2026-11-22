import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { Suspense } from "react";
import styles from "@/components/panel/panel.module.css";
import { ShareCard } from "@/components/panel/ShareCard";
import { requireOwner, siteOrigin } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/panel/settings";
import { SECTIONS } from "./sections";

export const metadata: Metadata = { title: "Ayarlar", robots: { index: false } };

export default function SettingsPage() {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p className={styles.sub}>Yükleniyor…</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const { shopId } = await requireOwner();
  const s = await getSettings(getDb(), shopId);
  const origin = await siteOrigin();
  const qrSvg = await QRCode.toString(`${origin}/${s.profile.slug}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" });

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Ayarlar</h1>
          <p className={styles.sub}>Değişiklikler yeni randevular için geçerlidir; alınmış randevular olduğu gibi kalır.</p>
        </div>
      </div>

      <ShareCard origin={origin} slug={s.profile.slug} qrSvg={qrSvg} shopName={s.profile.name} />

      <nav className={styles.menu} aria-label="Ayar bölümleri">
        {SECTIONS.map((sec) => (
          <Link key={sec.slug} href={`/panel/ayarlar/${sec.slug}`} className={styles.menuItem}>
            <span className={styles.menuText}>
              <b>{sec.title}</b>
              <small>{sec.hint(s)}</small>
            </span>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 1l6 6-6 6" />
            </svg>
          </Link>
        ))}
      </nav>
    </>
  );
}
