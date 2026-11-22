import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/components/panel/panel.module.css";
import { formatPrice } from "@/lib/domain/money";
import { requireOwner } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { getReport, REPORT_RANGES, type ReportRange } from "@/server/panel/reports";

export const metadata: Metadata = { title: "Raporlar", robots: { index: false } };

const WEEK = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p className={styles.sub}>Yükleniyor…</p>}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function RankList({ rows, money }: { rows: { name: string; count: number; revenueKurus: number }[]; money?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => (money ? r.revenueKurus : r.count)));
  if (rows.length === 0) return <div className="empty">Bu aralıkta veri yok.</div>;
  return (
    <ul className={styles.rank}>
      {rows.map((r) => (
        <li key={r.name}>
          <span>
            {r.name}
            <small>{r.count} randevu</small>
          </span>
          <b className="num">{formatPrice(r.revenueKurus)}</b>
          <i style={{ width: `${Math.max(4, ((money ? r.revenueKurus : r.count) / max) * 100)}%` }} />
        </li>
      ))}
    </ul>
  );
}

async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { shopId } = await requireOwner();
  const q = (await searchParams).aralik;
  const range: ReportRange = typeof q === "string" && q in REPORT_RANGES ? (q as ReportRange) : "30";
  const r = await getReport(getDb(), shopId, range);
  const t = r.totals;
  const peakDay = Math.max(1, ...r.byWeekday);
  const peakHour = Math.max(1, ...r.byHour.map((h) => h.count));

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Raporlar</h1>
          <p className={styles.sub}>{r.label}</p>
        </div>
      </div>
      <div className={styles.rangeTabs} role="tablist" aria-label="Aralık">
        {(Object.keys(REPORT_RANGES) as ReportRange[]).map((k) => (
          <Link key={k} href={k === "30" ? "/panel/raporlar" : `/panel/raporlar?aralik=${k}`} role="tab" aria-selected={k === range} replace scroll={false}>
            {REPORT_RANGES[k]}
          </Link>
        ))}
      </div>

      <section className={styles.bigStat}>
        <span>Kazanç</span>
        <b className="num">{formatPrice(t.revenueKurus)}</b>
        <small>
          {t.done} tamamlanan randevu, ortalama {formatPrice(t.averageKurus)}
        </small>
      </section>
      <div className={styles.stats}>
        <div>
          <b>{t.booked}</b>
          <span>Randevu</span>
        </div>
        <div>
          <b>{t.newCustomers}</b>
          <span>Yeni müşteri</span>
        </div>
        <div>
          <b>%{t.cancelRate}</b>
          <span>İptal oranı</span>
        </div>
      </div>
      {t.noShowRate > 0 && <p className={styles.hintLine}>Gelmeyenlerin oranı %{t.noShowRate}. Hatırlatma süresini ayarlardan kısaltabilirsiniz.</p>}

      <h2 className={styles.h2}>Hangi gün yoğun?</h2>
      <div className={styles.bars} role="img" aria-label="Haftanın günlerine göre randevu sayısı">
        {ORDER.map((d) => (
          <div key={d} data-peak={r.byWeekday[d] === peakDay && peakDay > 1 ? "true" : undefined}>
            <i style={{ height: `${(r.byWeekday[d] / peakDay) * 100}%` }} />
            <span>{WEEK[d]}</span>
            <b>{r.byWeekday[d]}</b>
          </div>
        ))}
      </div>

      {r.byHour.length > 0 && (
        <>
          <h2 className={styles.h2}>Hangi saat yoğun?</h2>
          <div className={styles.bars} role="img" aria-label="Saate göre randevu sayısı">
            {r.byHour.map((h) => (
              <div key={h.hour} data-peak={h.count === peakHour && peakHour > 1 ? "true" : undefined}>
                <i style={{ height: `${(h.count / peakHour) * 100}%` }} />
                <span>{String(h.hour).padStart(2, "0")}</span>
                <b>{h.count}</b>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className={styles.h2}>Hizmetler</h2>
      <RankList rows={r.byService} money />
      <h2 className={styles.h2}>Ustalar</h2>
      <RankList rows={r.byStaff} money />

      <h2 className={styles.h2}>En sık gelenler</h2>
      {r.topCustomers.length === 0 ? (
        <div className="empty">Bu aralıkta veri yok.</div>
      ) : (
        <ul className={styles.rank}>
          {r.topCustomers.map((c) => (
            <li key={c.name}>
              <span>
                {c.name}
                <small>{c.visits} ziyaret</small>
              </span>
              <b className="num">{formatPrice(c.spentKurus)}</b>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
