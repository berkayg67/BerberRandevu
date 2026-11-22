import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { dayLabel, DAYS_SHORT } from "@/components/booking/format";
import { AddAppointment } from "@/components/panel/AddAppointment";
import { DayList } from "@/components/panel/DayList";
import { DayStrip } from "@/components/panel/DayStrip";
import styles from "@/components/panel/panel.module.css";
import { formatPrice } from "@/lib/domain/money";
import { addDays, isLocalDate, weekdayOf } from "@/lib/domain/time";
import { requireOwner } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { getPanelShop, listDayAppointments } from "@/server/panel/service";

export const metadata: Metadata = { title: "Takvim", robots: { index: false } };

export default function CalendarPage({ searchParams }: PageProps<"/panel">) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p className={styles.sub}>Yükleniyor…</p>}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Calendar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { shopId } = await requireOwner();
  const db = getDb();
  const shop = await getPanelShop(db, shopId);
  const q = (await searchParams).gun;
  const date = typeof q === "string" && isLocalDate(q) ? q : shop.today;
  const { appointments, summary } = await listDayAppointments(db, shopId, date, shop.timezone);

  // Bir hafta geri, randevu verilen son güne kadar ileri.
  const days = Array.from({ length: 7 + shop.bookAheadDays }, (_, i) => addDays(shop.today, i - 7));
  if (!days.includes(date)) days.push(date);
  const full = dayLabel(date, "0000-00-00", shop.timezone); // "20 Kasım Cuma"
  const rel = dayLabel(date, shop.today, shop.timezone);
  const title = rel !== full ? rel : full.split(" ").slice(2).join(" ");

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>{title}</h1>
          <p className={styles.sub}>{full}</p>
        </div>
      </div>

      <DayStrip>
        {days.map((d) => (
          <Link
            key={d}
            href={d === shop.today ? "/panel" : `/panel?gun=${d}`}
            className={`${styles.day} ${d === shop.today ? styles.isToday : ""}`}
            aria-current={d === date ? "date" : undefined}
            scroll={false}
          >
            <span>{d === shop.today ? "Bugün" : DAYS_SHORT[weekdayOf(d)]}</span>
            <b>{Number(d.slice(8))}</b>
          </Link>
        ))}
      </DayStrip>

      <div className={styles.stats}>
        <div>
          <b>{summary.count}</b>
          <span>Randevu</span>
        </div>
        <div>
          <b>{formatPrice(summary.expectedKurus)}</b>
          <span>Beklenen</span>
        </div>
        <div>
          <b>{summary.cancelled + summary.noShow}</b>
          <span>İptal / gelmedi</span>
        </div>
      </div>

      <DayList appointments={appointments} />
      <AddAppointment shop={shop} defaultDate={date < shop.today ? shop.today : date} />
    </>
  );
}
