import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import styles from "@/components/booking/booking.module.css";
import { CustomerApp } from "@/components/booking/CustomerApp";
import { OpenStatus } from "@/components/booking/OpenStatus";
import { ShopHero } from "@/components/shop/ShopHero";
import { BookingError } from "@/server/booking/errors";
import { getDb } from "@/server/db/client";
import { getPublicShop } from "@/server/shops/service";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function loadShop(slug: string) {
  if (!SLUG.test(slug)) notFound();
  try {
    return await getPublicShop(getDb(), slug);
  } catch (e) {
    if (e instanceof BookingError && e.code === "NOT_FOUND") notFound();
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
        hours={shop.hours}
        lunch={shop.lunch}
      />
      <div className={styles.column}>
        <CustomerApp shop={shop} />
      </div>
    </>
  );
}
