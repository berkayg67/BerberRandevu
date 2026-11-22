import type { ReactNode } from "react";
import { Plate } from "@/components/ui/Plate";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import styles from "./ShopHero.module.css";

type ShopHeroProps = {
  district: string;
  name: string;
  address: string;
  /** Adresin üstünde gösterilen durum satırı (açık / kapalı). */
  status?: ReactNode;
};

/** Müşteri sayfasının üst bandı: fayans zemin, emaye tabela, adres. */
export function ShopHero({ district, name, address, status }: ShopHeroProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.top}>
        <ThemeToggle />
      </div>
      <h1 className={styles.title}>
        <Plate district={district} name={name} />
      </h1>
      <div className={styles.facts}>
        {status}
        <p className={styles.address}>{address}</p>
      </div>
    </header>
  );
}
