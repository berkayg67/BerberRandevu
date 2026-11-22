/**
 * Berber raporları: gelir, randevu sayıları, hizmet ve usta dağılımı, yoğun gün ve saatler.
 * Gelir yalnızca gerçekleşen randevulardan hesaplanır (bitmiş, iptal olmayan, "gelmedi" işaretlenmemiş).
 */
import { and, eq, gte, lt } from "drizzle-orm";
import { addDays, todayIn, utcToZoned, weekdayOf, zonedToUtc } from "@/lib/domain/time";
import { BookingError } from "@/server/booking/errors";
import { appointments, customers, shops, staff } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export const REPORT_RANGES = { "7": "Son 7 gün", "30": "Son 30 gün", "90": "Son 90 gün" } as const;
export type ReportRange = keyof typeof REPORT_RANGES;

type Row = { count: number; revenueKurus: number };
const bump = (m: Map<string, Row>, key: string, price: number) => {
  const r = m.get(key) ?? { count: 0, revenueKurus: 0 };
  r.count++;
  r.revenueKurus += price;
  m.set(key, r);
};
const ranked = (m: Map<string, Row>) =>
  [...m.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenueKurus - a.revenueKurus || b.count - a.count || a.name.localeCompare(b.name, "tr"));

export async function getReport(db: Db, shopId: string, range: ReportRange, now: Date = new Date()) {
  const [shop] = await db.select({ tz: shops.timezone }).from(shops).where(eq(shops.id, shopId));
  if (!shop) throw new BookingError("NOT_FOUND", "Dükkân bulunamadı.");
  const days = Number(range);
  const today = todayIn(shop.tz, now);
  const firstDay = addDays(today, -(days - 1));
  const from = zonedToUtc(firstDay, 0, shop.tz);
  const to = zonedToUtc(addDays(today, 1), 0, shop.tz);

  const rows = await db
    .select({
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      noShow: appointments.noShow,
      price: appointments.priceKurus,
      serviceName: appointments.serviceName,
      staffName: staff.name,
      customerId: appointments.customerId,
      customerName: customers.name,
    })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .where(and(eq(appointments.shopId, shopId), gte(appointments.startsAt, from), lt(appointments.startsAt, to)));

  const services = new Map<string, Row>();
  const staffMap = new Map<string, Row>();
  const weekday = Array.from({ length: 7 }, () => 0);
  const hours = new Map<number, number>();
  const people = new Map<string, { name: string; visits: number; spentKurus: number }>();
  let cancelled = 0;
  let noShow = 0;
  let done = 0;
  let upcoming = 0;
  let revenue = 0;

  for (const r of rows) {
    if (r.status === "cancelled") {
      cancelled++;
      continue;
    }
    if (r.noShow) {
      noShow++;
      continue;
    }
    if (r.endsAt > now) {
      upcoming++;
      continue;
    }
    done++;
    revenue += r.price;
    bump(services, r.serviceName, r.price);
    bump(staffMap, r.staffName, r.price);
    const local = utcToZoned(r.startsAt, shop.tz);
    weekday[weekdayOf(local.date)]++;
    const h = Math.floor(local.minutes / 60);
    hours.set(h, (hours.get(h) ?? 0) + 1);
    const p = people.get(r.customerId) ?? { name: r.customerName, visits: 0, spentKurus: 0 };
    p.visits++;
    p.spentKurus += r.price;
    people.set(r.customerId, p);
  }

  const booked = rows.length;
  // Aralıkta ilk kez kaydolan müşteriler.
  const newCustomers = (
    await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.shopId, shopId), gte(customers.createdAt, from), lt(customers.createdAt, to)))
  ).length;

  return {
    range,
    label: REPORT_RANGES[range],
    from: firstDay,
    to: today,
    totals: {
      booked,
      done,
      upcoming,
      cancelled,
      noShow,
      revenueKurus: revenue,
      averageKurus: done ? Math.round(revenue / done) : 0,
      /** Yüzde, tam sayı. Randevu yoksa 0. */
      cancelRate: booked ? Math.round((cancelled / booked) * 100) : 0,
      noShowRate: booked ? Math.round((noShow / booked) * 100) : 0,
      newCustomers,
      uniqueCustomers: people.size,
    },
    byService: ranked(services),
    byStaff: ranked(staffMap),
    /** 0 = Pazar ... 6 = Cumartesi. */
    byWeekday: weekday,
    byHour: [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([hour, count]) => ({ hour, count })),
    topCustomers: [...people.values()]
      .sort((a, b) => b.visits - a.visits || b.spentKurus - a.spentKurus || a.name.localeCompare(b.name, "tr"))
      .slice(0, 5),
  };
}

export type Report = Awaited<ReturnType<typeof getReport>>;
