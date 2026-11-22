import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import styles from "@/components/admin/admin.module.css";
import { OwnerAccounts } from "@/components/admin/OwnerAccounts";
import { PeriodRow } from "@/components/admin/PeriodRow";
import { ShopForm } from "@/components/admin/ShopForm";
import { formatPrice } from "@/lib/domain/money";
import { formatPeriodTr } from "@/lib/domain/period";
import { formatPhone } from "@/lib/domain/phone";
import { formatDayTr } from "@/lib/domain/time";
import { getShopForAdmin } from "@/server/admin/service";
import { requireAdmin } from "@/server/auth/current";
import { listOwners } from "@/server/auth/service";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Dükkân, Yönetim", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHOD: Record<string, string> = { nakit: "Nakit", havale: "Havale / EFT", kart: "Kart", diger: "Diğer" };

export default function ShopPage({ params }: PageProps<"/admin/dukkanlar/[id]">) {
  return (
    <>
      <Link href="/admin" className={styles.back}>
        Tüm dükkânlar
      </Link>
      <Suspense fallback={<p className={styles.loading}>Yükleniyor…</p>}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getShopForAdmin(getDb(), id);
  if (!data) notFound();
  const { shop } = data;
  const fee = shop.monthlyFeeKurus;
  const owners = await listOwners(getDb(), shop.id);

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>{shop.name}</h1>
          <p className={styles.sub}>
            {shop.district}
            {shop.ownerName ? `, ${shop.ownerName}` : ""}
            {shop.ownerPhone ? `, ${formatPhone(shop.ownerPhone)}` : ""}
          </p>
        </div>
        {shop.active ? <span className="tag tag-green">Açık</span> : <span className="tag tag-grey">Durduruldu</span>}
      </div>

      <div className={styles.stats}>
        <div>
          <b>{formatPrice(fee)}</b>
          <span>Aylık ücret</span>
        </div>
        <div>
          <b>{data.unpaidPeriods.length}</b>
          <span>Ödenmemiş ay</span>
        </div>
        <div>
          <b>{formatPrice(data.unpaidKurus)}</b>
          <span>Bekleyen alacak</span>
        </div>
      </div>

      <p className={styles.sub}>
        Müşteri sayfası: <Link href={`/${shop.slug}`} className={styles.back} style={{ margin: 0 }}>/{shop.slug}</Link>
      </p>

      <h2 className={styles.h2}>Tahsilat</h2>
      {fee === 0 && <p className={styles.sub} style={{ marginBottom: 12 }}>Bu dükkân ücretsiz. Yine de ödeme kaydedebilirsiniz.</p>}
      <div className="group">
        {data.periods.map(({ period, payment }) => (
          <PeriodRow
            key={period}
            shopId={shop.id}
            period={period}
            label={formatPeriodTr(period)}
            isCurrent={period === data.currentPeriod}
            defaultAmount={(fee / 100).toLocaleString("tr-TR")}
            paid={
              payment
                ? {
                    text: `${formatPrice(payment.amountKurus)}, ${METHOD[payment.method]}, ${formatDayTr(payment.paidAt, "Europe/Istanbul")}${payment.note ? `. ${payment.note}` : ""}`,
                  }
                : null
            }
          />
        ))}
      </div>

      <h2 className={styles.h2}>Berber hesabı</h2>
      <p className={styles.sub} style={{ marginBottom: 12 }}>
        Berber bu hesapla /panel adresinden kendi randevularını yönetir.
      </p>
      <OwnerAccounts
        shopId={shop.id}
        owners={owners.map((o) => ({
          id: o.id,
          email: o.email,
          name: o.name,
          active: o.active,
          lastLogin: o.lastLoginAt ? formatDayTr(o.lastLoginAt, "Europe/Istanbul") : null,
        }))}
      />

      <h2 className={styles.h2}>Bilgiler</h2>
      <ShopForm
        mode="edit"
        shopId={shop.id}
        defaults={{
          name: shop.name,
          district: shop.district,
          address: shop.address,
          phone: shop.phone,
          notifyPhone: formatPhone(shop.notifyPhone),
          ownerName: shop.ownerName,
          ownerPhone: shop.ownerPhone ? formatPhone(shop.ownerPhone) : null,
          monthlyFee: (fee / 100).toLocaleString("tr-TR"),
          billingStart: shop.billingStart,
          adminNotes: shop.adminNotes,
          active: shop.active,
        }}
      />
    </>
  );
}
