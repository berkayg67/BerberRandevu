"use client";

import { useEffect, useState } from "react";
import type { PublicShop } from "@/server/shops/service";
import styles from "./booking.module.css";
import { BookingFlow } from "./BookingFlow";
import { MyAppointments } from "./MyAppointments";

type Tab = "randevu" | "randevularim";

/** Müşteri sayfasının iki sekmesi. "#randevularim" bağlantısı doğrudan ikinci sekmeyi açar. */
export function CustomerApp({ shop }: { shop: PublicShop }) {
  const [tab, setTab] = useState<Tab>("randevu");

  useEffect(() => {
    const sync = () => setTab(location.hash === "#randevularim" ? "randevularim" : "randevu");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function select(next: Tab) {
    setTab(next);
    history.replaceState(null, "", next === "randevularim" ? "#randevularim" : location.pathname);
  }

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Sayfa bölümleri">
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === "randevu"} onClick={() => select("randevu")}>
          Randevu al
        </button>
        <button
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={tab === "randevularim"}
          onClick={() => select("randevularim")}
        >
          Randevularım
        </button>
      </div>
      <div role="tabpanel">{tab === "randevu" ? <BookingFlow shop={shop} /> : <MyAppointments shop={shop} />}</div>
    </>
  );
}
