import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/components/admin/admin.module.css";
import { ShopForm } from "@/components/admin/ShopForm";
import { todayIn } from "@/lib/domain/time";
import { requireAdmin } from "@/server/auth/current";

export const metadata: Metadata = { title: "Dükkân ekle, Yönetim", robots: { index: false } };

export default function NewShopPage() {
  return (
    <>
      <Link href="/admin" className={styles.back}>
        Tüm dükkânlar
      </Link>
      <h1 className={styles.h1}>Dükkân ekle</h1>
      <p className={styles.sub}>
        Pazartesi–Cumartesi 09:00–21:00 çalışma saatleri, 6 temel hizmet ve bir usta ile açılır. Bunları dükkân
        sonradan kendi panelinden değiştirebilir.
      </p>
      <div style={{ marginTop: 20 }}>
        <Suspense fallback={<p className={styles.loading}>Yükleniyor…</p>}>
          <Form />
        </Suspense>
      </div>
    </>
  );
}

async function Form() {
  await requireAdmin();
  return <ShopForm mode="create" defaults={{ billingStart: todayIn("Europe/Istanbul", new Date()) }} />;
}
