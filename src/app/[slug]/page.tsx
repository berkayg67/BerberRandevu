import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import styles from "@/components/booking/booking.module.css";
import { CustomerApp } from "@/components/booking/CustomerApp";
import { OpenStatus } from "@/components/booking/OpenStatus";
import Link from "next/link";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { ShopHero } from "@/components/shop/ShopHero";
import { BookingError } from "@/server/booking/errors";
import { getDb } from "@/server/db/client";
import { findRedirectSlug, getPublicShop } from "@/server/shops/service";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function loadShop(slug: string) {
  if (!SLUG.test(slug)) notFound();
  try {
    return await getPublicShop(getDb(), slug);
  } catch (e) {
    if (e instanceof BookingError && e.code === "NOT_FOUND") {
      // Berber adresini değiştirdiyse eski bağlantılar yeni adrese gider.
      const moved = await findRedirectSlug(getDb(), slug);
      if (moved && moved !== slug) permanentRedirect(`/${moved}`);
      notFound();
    }
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const shop = await loadShop(slug);
  return {
    title: `${shop.name}, online randevu`,
    description: `${shop.name} (${shop.district}) için online randevu alın. ${shop.address}`,
  };
}

export default function ShopPage({ params }: PageProps<"/[slug]">) {
  return (
    <div className={styles.app}>
      <Suspense fallback={<p style={{ padding: 24, color: "var(--muted)" }}>Yükleniyor…</p>}>
        <Shop params={params} />
      </Suspense>
    </div>
  );
}

async function Shop({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const shop = await loadShop(slug);
  return (
    <>
      <ShopHero
        district={shop.district}
        name={shop.name}
        address={shop.address}
        status={<OpenStatus hours={shop.hours} lunch={shop.lunch} timeZone={shop.timezone} />}
        logoId={shop.logoId}
        staff={shop.staff}
      />
      <div className={styles.column}>
        <CustomerApp shop={shop} />
        <footer className={styles.legalFoot}>
          <LegalLinks />
          <p>
            Randevu sistemi: <Link href="/">Tıraş Vakti</Link>. Bu sayfadaki bilgi ve fotoğrafları dükkân sahibi
            yayımlar; Tıraş Vakti yer sağlayıcıdır.{" "}
            <Link href={`/icerik-bildir?sayfa=${encodeURIComponent(`/${shop.slug}`)}`}>İçeriği bildir</Link>
          </p>
        </footer>
      </div>
    </>
  );
}
