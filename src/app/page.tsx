import { ShopHero } from "@/components/shop/ShopHero";
import { demoShop } from "@/config/shop";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.app}>
      <ShopHero
        district={demoShop.district}
        name={demoShop.name}
        address={demoShop.address}
      />
      <main className={styles.main}>
        <div className="empty">
          Randevu alma ekranı 4. adımda burada olacak.
        </div>
      </main>
    </div>
  );
}
