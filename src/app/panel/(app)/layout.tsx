import Link from "next/link";
import { Suspense } from "react";
import { logoutOwner } from "@/app/panel/actions";
import { PanelNav, PanelNavFallback } from "@/components/panel/PanelNav";
import styles from "@/components/panel/panel.module.css";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Plate } from "@/components/ui/Plate";
import { requireOwner } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { getPanelShop } from "@/server/panel/service";

/** Üst bant: dükkânın tabelası. Oturuma bağlı olduğu için ayrı yüklenir. */
async function ShopPlate() {
  const { shopId } = await requireOwner();
  const shop = await getPanelShop(getDb(), shopId);
  return (
    <>
      <Link href="/panel" aria-label="Takvim" style={{ textDecoration: "none" }}>
        <Plate district={shop.district} name={shop.name} size="sm" />
      </Link>
      {!shop.active && (
        <p className={styles.banner} role="status" style={{ position: "absolute", left: 0, right: 0, top: "100%", margin: "8px 20px" }}>
          Dükkânınız şu an durdurulmuş: müşteriler online randevu alamıyor. Lütfen bizimle iletişime geçin.
        </p>
      )}
    </>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className={styles.shell}>
      <header className={`${styles.head} material`}>
        <Suspense fallback={<span />}>
          <ShopPlate />
        </Suspense>
        <div className={styles.headRight}>
          <ThemeToggle />
          <form action={logoutOwner}>
            <button type="submit" className={styles.logout}>
              Çıkış yap
            </button>
          </form>
        </div>
      </header>
      {children}
      <Suspense fallback={<PanelNavFallback />}>
        <PanelNav />
      </Suspense>
    </div>
  );
}
