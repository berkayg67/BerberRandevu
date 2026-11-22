import Link from "next/link";
import type { ReactNode } from "react";
import { Plate } from "@/components/ui/Plate";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Avatar } from "./Avatar";
import styles from "./ShopHero.module.css";

type ShopHeroProps = {
  district: string;
  name: string;
  address: string;
  /** Adresin üstünde gösterilen durum satırı (açık / kapalı). */
  status?: ReactNode;
  logoId?: string | null;
  staff?: { id: string; name: string; photoId: string | null }[];
};

/** Müşteri sayfasının fayans duvarı: giriş bağlantıları, logo ve usta yüzleri, emaye tabela, durum, adres. */
export function ShopHero({ district, name, address, status, logoId, staff = [] }: ShopHeroProps) {
  const faces = staff.slice(0, 4);
  return (
    <header className={styles.hero}>
      <div className={styles.top}>
        <nav className={styles.logins} aria-label="Giriş">
          <Link href="/panel/giris" className={styles.login}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" />
            </svg>
            Berber girişi
          </Link>
          <Link href="/admin/giris" className={styles.login}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
            </svg>
            Yönetici
          </Link>
        </nav>
        <ThemeToggle />
      </div>
      {(logoId || faces.length > 0) && (
        <div className={styles.faces} aria-hidden="true">
          {logoId && <Avatar name={name} photoId={logoId} size={64} ring />}
          {faces.length > 0 && (
            <span className={styles.stack}>
              {faces.map((s) => (
                <Avatar key={s.id} name={s.name} photoId={s.photoId} size={40} ring />
              ))}
            </span>
          )}
        </div>
      )}
      <h1 className={styles.title}>
        <Plate district={district} name={name} />
      </h1>
      <p className={styles.kicker}>Online randevu</p>
      <div className={styles.facts}>
        {status}
        <p className={styles.address}>{address}</p>
      </div>
    </header>
  );
}
