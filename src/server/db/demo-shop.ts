import { eq } from "drizzle-orm";
import { services, shops, staff, workingHours } from "./schema";
import type { Db } from "./types";

/**
 * Demo dükkân. Gerçek işletmeye geçerken bu bilgiler panelden
 * (yol haritası 5. adım) ya da bu dosyadan değiştirilir.
 */
export const DEMO_SHOP = {
  slug: "berber-demo",
  name: "Berber Demo",
  district: "Üsküdar",
  address: "Örnek Mah. Örnek Sk. No:1, Üsküdar / İstanbul",
  phone: "0532 000 00 00",
  notifyPhone: "5320000000",
  reviewUrl: "https://g.page/r/ORNEK/review",
  breakStart: "13:00",
  breakEnd: "13:45",
  slotMinutes: 15,
  bufferMinutes: 5,
  minNoticeMinutes: 30,
  bookAheadDays: 14,
  reminderMinutesBefore: 60,
  thanksMinutesAfter: 30,
} as const;

const DEMO_STAFF = ["Murat", "Emre"];

/** Yeni açılan her dükkâna başlangıçta eklenen hizmetler; dükkân sonradan değiştirir. */
export const DEFAULT_SERVICES = [
  { name: "Saç kesimi", durationMinutes: 30, priceKurus: 50_000 },
  { name: "Sakal tıraşı", durationMinutes: 20, priceKurus: 25_000 },
  { name: "Saç ve sakal", durationMinutes: 45, priceKurus: 70_000 },
  { name: "Çocuk saç kesimi", durationMinutes: 30, priceKurus: 40_000 },
  { name: "Cilt bakımı", durationMinutes: 30, priceKurus: 45_000 },
  { name: "Yıkama ve fön", durationMinutes: 15, priceKurus: 15_000 },
];

/** Pazartesi–Cumartesi 09:00–21:00, Pazar kapalı. */
export const DEFAULT_HOURS = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "09:00", closes: "21:00" }));

/**
 * Demo dükkânı ekler. Zaten varsa dokunmaz (tekrar çalıştırmak güvenlidir).
 * @returns eklendiyse true, zaten varsa false
 */
export async function seedDemoShop(db: Db): Promise<{ created: boolean; shopId: string }> {
  const [existing] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, DEMO_SHOP.slug));
  if (existing) return { created: false, shopId: existing.id };

  return db.transaction(async (tx) => {
    const [shop] = await tx.insert(shops).values(DEMO_SHOP).returning({ id: shops.id });
    await tx.insert(workingHours).values(DEFAULT_HOURS.map((h) => ({ ...h, shopId: shop.id })));
    await tx.insert(staff).values(DEMO_STAFF.map((name, sort) => ({ shopId: shop.id, name, sort })));
    await tx
      .insert(services)
      .values(DEFAULT_SERVICES.map((s, sort) => ({ ...s, shopId: shop.id, sort })));
    return { created: true, shopId: shop.id };
  });
}
