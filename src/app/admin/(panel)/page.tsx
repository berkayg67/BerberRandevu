import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/components/admin/admin.module.css";
import { formatPrice } from "@/lib/domain/money";
import { formatPeriodTr } from "@/lib/domain/period";
import { listShopsOverview, type ShopsOverview } from "@/server/admin/service";
import { requireAdmin } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { PendingShops, ResetRequests } from "@/components/admin/Requests";
import { listPendingShops, listResetRequests } from "@/server/signup/service";

const when = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export const metadata: Metadata = {
  title: "Dükkânlar, Yönetim",
  robots: { index: false },
};

export default function AdminHome() {
  return (
    <Suspense fallback={<p className={styles.loading}>Yükleniyor…</p>}>
      <Overview />
    </Suspense>
  );
}

function statusTag(s: ShopsOverview["shops"][number]) {
  if (!s.active) return <span className="tag tag-grey">Durduruldu</span>;
  if (s.monthlyFeeKurus === 0)
    return <span className="tag tag-grey">Ücretsiz</span>;
  if (s.unpaidPeriods.length > 1)
    return (
      <span className="tag tag-red">{s.unpaidPeriods.length} ay bekliyor</span>
    );
  if (s.currentPaid) return <span className="tag tag-green">Bu ay ödendi</span>;
  if (s.currentDue)
    return <span className="tag tag-yellow">Bu ay bekliyor</span>;
  return <span className="tag tag-grey">Abonelik başlamadı</span>;
}

async function Overview() {
  await requireAdmin();
  const db = getDb();
  const [data, pending, resets] = await Promise.all([
    listShopsOverview(db),
    listPendingShops(db),
    listResetRequests(db),
  ]);

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Dükkânlar</h1>
          <p className={styles.sub}>
            {formatPeriodTr(data.currentPeriod)} durumu
          </p>
        </div>
        <Link href="/admin/dukkanlar/yeni" className="btn btn-primary">
          Dükkân ekle
        </Link>
      </div>

      {pending.length > 0 && (
        <PendingShops
          items={pending.map((p) => ({
            ...p,
            createdAt: when.format(p.createdAt),
          }))}
        />
      )}
      {
        <ResetRequests
          items={resets.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            shopName: r.shopName,
            ownerPhone: r.ownerPhone,
            createdAt: when.format(r.createdAt),
          }))}
        />
      }

      <div className={styles.stats}>
        <div>
          <b>{data.totals.active}</b>
          <span>Aktif dükkân</span>
        </div>
        <div>
          <b>{formatPrice(data.totals.collectedThisMonthKurus)}</b>
          <span>Bu ay tahsil edilen</span>
        </div>
        <div>
          <b>{formatPrice(data.totals.outstandingKurus)}</b>
          <span>Bekleyen alacak</span>
        </div>
      </div>

      {data.shops.length === 0 ? (
        <div className="empty">
          Henüz dükkân yok. Sağ üstteki <b>Dükkân ekle</b> ile ilk berberi
          kaydedin.
        </div>
      ) : (
        <div className="group">
          {data.shops.map((s) => (
            <Link
              key={s.id}
              href={`/admin/dukkanlar/${s.id}`}
              className={styles.shopRow}
            >
              <span className={styles.shopName}>{s.name}</span>
              <span className={styles.shopRight}>
                <span className={styles.fee}>
                  {formatPrice(s.monthlyFeeKurus)} <small>/ ay</small>
                </span>
                {statusTag(s)}
              </span>
              <span className={styles.shopMeta}>
                {s.district}
                {s.ownerName ? `, ${s.ownerName}` : ""}. Son 30 günde{" "}
                {s.appointmentsLast30Days} randevu
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
