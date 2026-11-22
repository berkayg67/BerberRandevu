import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Closures } from "@/components/panel/Closures";
import styles from "@/components/panel/panel.module.css";
import {
  ContactSection,
  HoursSection,
  PhotosSection,
  ProfileSection,
  RulesSection,
  ServicesSection,
  StaffSection,
} from "@/components/panel/settings-sections";
import { AccountForm, ChangePasswordForm } from "@/components/auth/SecurityForms";
import { requireOwner } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { listClosures } from "@/server/panel/closures";
import { listPhotos, listPortraits } from "@/server/panel/photos";
import { getPanelShop } from "@/server/panel/service";
import { getSettings } from "@/server/panel/settings";
import { SECTIONS } from "../sections";

export const metadata: Metadata = { title: "Ayarlar", robots: { index: false } };

export default function SettingsSectionPage({ params }: { params: Promise<{ bolum: string }> }) {
  return (
    <main className={styles.main}>
      <Link href="/panel/ayarlar" className={styles.backLink}>
        Ayarlar
      </Link>
      <Suspense fallback={<p className={styles.sub}>Yükleniyor…</p>}>
        <Section params={params} />
      </Suspense>
    </main>
  );
}

async function Section({ params }: { params: Promise<{ bolum: string }> }) {
  const { bolum } = await params;
  const sec = SECTIONS.find((x) => x.slug === bolum);
  if (!sec) notFound();
  const user = await requireOwner();
  const db = getDb();
  const s = await getSettings(db, user.shopId);

  let body: React.ReactNode;
  switch (bolum) {
    case "dukkan":
      body = <ProfileSection s={s} />;
      break;
    case "fotograflar": {
      const [photos, portraits] = await Promise.all([listPhotos(db, user.shopId), listPortraits(db, user.shopId)]);
      body = <PhotosSection s={s} photos={photos} logoId={portraits.logoId} />;
      break;
    }
    case "saatler": {
      const [closures, shop] = await Promise.all([listClosures(db, user.shopId), getPanelShop(db, user.shopId)]);
      body = (
        <>
          <HoursSection s={s} />
          <h2 className={styles.h2}>Tatil ve izin günleri</h2>
          <p className={styles.sub} style={{ marginBottom: 8 }}>
            Bu günlerde müşteriler online randevu alamaz.
          </p>
          <Closures closures={closures} today={shop.today} />
        </>
      );
      break;
    }
    case "kurallar":
      body = <RulesSection s={s} />;
      break;
    case "hizmetler":
      body = <ServicesSection s={s} />;
      break;
    case "ustalar": {
      const portraits = await listPortraits(db, user.shopId);
      body = <StaffSection s={s} portraits={portraits.staffPhotos} />;
      break;
    }
    case "iletisim":
      body = <ContactSection s={s} />;
      break;
    default:
      body = (
        <>
          <h2 className={styles.h2}>Bilgiler</h2>
          <AccountForm name={user.name} email={user.email} />
          <h2 className={styles.h2}>Şifre</h2>
          <ChangePasswordForm />
        </>
      );
  }

  return (
    <>
      <div className={styles.titleRow}>
        <h1 className={styles.h1}>{sec.title}</h1>
      </div>
      {body}
    </>
  );
}
