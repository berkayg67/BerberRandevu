import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND, LogoMark } from "@/components/brand/Logo";
import { LegalLinks } from "@/components/legal/LegalLinks";
import styles from "./auth.module.css";

/**
 * Giriş, kayıt ve şifre sayfalarının ortak çerçevesi. Solda (telefonda üstte) markanın
 * canlı mavi alanı, yanında sakin kâğıt üzerinde form.
 */
export function AuthShell({
  title,
  intro,
  children,
  footer,
  wide = false,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.brand}>
        <Link href="/" className={styles.brandLink} aria-label={`${BRAND} ana sayfa`}>
          <LogoMark size={48} />
          <span className={styles.brandName}>{BRAND}</span>
        </Link>
        <p className={styles.tagline}>Mahalle berberinin randevu defteri, artık telefonda.</p>
        <span className={styles.stripe} aria-hidden="true" />
      </aside>
      <main className={styles.formSide}>
        <div className={`${styles.card} ${wide ? styles.wide : ""}`}>
          <h1 className={styles.h1}>{title}</h1>
          {intro && <div className={styles.intro}>{intro}</div>}
          {children}
          <div className={styles.footer}>
            {footer}
            <Link href="/" className={styles.back}>
              Ana sayfaya dön
            </Link>
          </div>
          <LegalLinks />
        </div>
      </main>
    </div>
  );
}
