import { and, asc, eq, inArray } from "drizzle-orm";
import { addDays, todayIn, toHHMM, toMinutes } from "@/lib/domain/time";
import { services, shopPhotos, shopSlugRedirects, shops, staff, workingHours } from "@/server/db/schema";
import { closedDatesBetween } from "./closures";
import type { Db } from "@/server/db/types";
import { BookingError } from "@/server/booking/errors";

/** Eski bir adres artık hangi adrese gidiyor? Yoksa null. */
export async function findRedirectSlug(db: Db, oldSlug: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: shops.slug })
    .from(shopSlugRedirects)
    .innerJoin(shops, eq(shops.id, shopSlugRedirects.shopId))
    .where(eq(shopSlugRedirects.oldSlug, oldSlug));
  return row?.slug ?? null;
}

export async function getShopBySlug(db: Db, slug: string) {
  const [shop] = await db.select().from(shops).where(eq(shops.slug, slug));
  // Yönetici tarafından durdurulan dükkân müşterilere hiç görünmez.
  if (!shop || !shop.active) throw new BookingError("NOT_FOUND", "Dükkân bulunamadı.");
  return shop;
}

/** Müşteri sayfasının ihtiyaç duyduğu, herkese açık dükkân bilgileri. */
export async function getPublicShop(db: Db, slug: string, now: Date = new Date()) {
  const shop = await getShopBySlug(db, slug);

  const today = todayIn(shop.timezone, now);
  const lastBookableDay = addDays(today, shop.bookAheadDays - 1);

  const [hours, staffRows, serviceRows, photos, portraits, closed] = await Promise.all([
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
    db
      .select({ id: shopPhotos.id, width: shopPhotos.width, height: shopPhotos.height })
      .from(shopPhotos)
      .where(and(eq(shopPhotos.shopId, shop.id), eq(shopPhotos.kind, "gallery")))
      .orderBy(asc(shopPhotos.sort), asc(shopPhotos.createdAt)),
    db
      .select({ id: shopPhotos.id, kind: shopPhotos.kind, staffId: shopPhotos.staffId })
      .from(shopPhotos)
      .where(and(eq(shopPhotos.shopId, shop.id), inArray(shopPhotos.kind, ["logo", "staff"]))),
    closedDatesBetween(db, shop.id, today, lastBookableDay),
  ]);

  const hhmm = (t: string) => toHHMM(toMinutes(t));

  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    district: shop.district,
    address: shop.address,
    phone: shop.phone,
    description: shop.description,
    photos,
    logoId: portraits.find((p) => p.kind === "logo")?.id ?? null,
    timezone: shop.timezone,
    today,
    lastBookableDay,
    /** Tatil ve izin nedeniyle online randevuya kapalı günler. */
    closedDates: [...closed].sort(),
    lunch: shop.breakStart && shop.breakEnd ? { start: hhmm(shop.breakStart), end: hhmm(shop.breakEnd) } : null,
    hours: hours.map((h) => ({ weekday: h.weekday, opens: hhmm(h.opens), closes: hhmm(h.closes) })),
    staff: staffRows.map((m) => ({ ...m, photoId: portraits.find((p) => p.kind === "staff" && p.staffId === m.id)?.id ?? null })),
    services: serviceRows,
  };
}

export type PublicShop = Awaited<ReturnType<typeof getPublicShop>>;
