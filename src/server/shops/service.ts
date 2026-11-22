import { and, asc, eq } from "drizzle-orm";
import { addDays, todayIn, toHHMM, toMinutes } from "@/lib/domain/time";
import { services, shops, staff, workingHours } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { BookingError } from "@/server/booking/errors";

export async function getShopBySlug(db: Db, slug: string) {
  const [shop] = await db.select().from(shops).where(eq(shops.slug, slug));
  if (!shop) throw new BookingError("NOT_FOUND", "Dükkân bulunamadı.");
  return shop;
}

/** Müşteri sayfasının ihtiyaç duyduğu, herkese açık dükkân bilgileri. */
export async function getPublicShop(db: Db, slug: string, now: Date = new Date()) {
  const shop = await getShopBySlug(db, slug);

  const [hours, staffRows, serviceRows] = await Promise.all([
    db
      .select({ weekday: workingHours.weekday, opens: workingHours.opens, closes: workingHours.closes })
      .from(workingHours)
      .where(eq(workingHours.shopId, shop.id))
      .orderBy(asc(workingHours.weekday)),
    db
      .select({ id: staff.id, name: staff.name })
      .from(staff)
      .where(and(eq(staff.shopId, shop.id), eq(staff.active, true)))
      .orderBy(asc(staff.sort), asc(staff.createdAt)),
    db
      .select({
        id: services.id,
        name: services.name,
        durationMinutes: services.durationMinutes,
        priceKurus: services.priceKurus,
      })
      .from(services)
      .where(and(eq(services.shopId, shop.id), eq(services.active, true)))
      .orderBy(asc(services.sort), asc(services.createdAt)),
  ]);

  const today = todayIn(shop.timezone, now);
  const hhmm = (t: string) => toHHMM(toMinutes(t));

  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    district: shop.district,
    address: shop.address,
    phone: shop.phone,
    timezone: shop.timezone,
    today,
    lastBookableDay: addDays(today, shop.bookAheadDays - 1),
    lunch: shop.breakStart && shop.breakEnd ? { start: hhmm(shop.breakStart), end: hhmm(shop.breakEnd) } : null,
    hours: hours.map((h) => ({ weekday: h.weekday, opens: hhmm(h.opens), closes: hhmm(h.closes) })),
    staff: staffRows,
    services: serviceRows,
  };
}

export type PublicShop = Awaited<ReturnType<typeof getPublicShop>>;
