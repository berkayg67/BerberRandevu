import { Plate } from "@/components/ui/Plate";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import styles from "./ShopHero.module.css";

type ShopHeroProps = {
  district: string;
  name: string;
  address: string;
};

/** Müşteri sayfasının üst bandı: fayans zemin, emaye tabela, adres. */
export function ShopHero({ district, name, address }: ShopHeroProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.top}>
        <ThemeToggle />
      </div>
      <h1 className={styles.title}>
        <Plate district={district} name={name} />
      </h1>
      <p className={styles.address}>{address}</p>
    </header>
  );
}
