/**
 * Berberin kendi dükkân ayarları. Dükkân adı ve aylık ücret yönetimdedir;
 * geri kalanını berber değiştirir. Tüm değişiklikler yalnızca yeni randevuları etkiler.
 */
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { normalizeName } from "@/lib/domain/names";
import { normalizePhone } from "@/lib/domain/phone";
import { toMinutes, toHHMM } from "@/lib/domain/time";
import { BookingError } from "@/server/booking/errors";
import { appointments, services, shops, staff, workingHours } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

const fail = (message: string): never => {
  throw new BookingError("INVALID_INPUT", message);
};
const hhmm = (t: string) => toHHMM(toMinutes(t));
const validTime = (t: string) => /^\d{2}:\d{2}$/.test(t) && toMinutes(t) >= 0 && toMinutes(t) < 24 * 60;

export async function getSettings(db: Db, shopId: string) {
  const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!shop) fail("Dükkân bulunamadı.");
  const [hours, serviceRows, staffRows] = await Promise.all([
    db.select().from(workingHours).where(eq(workingHours.shopId, shopId)),
    db.select().from(services).where(eq(services.shopId, shopId)).orderBy(asc(services.sort), asc(services.createdAt)),
    db.select().from(staff).where(eq(staff.shopId, shopId)).orderBy(asc(staff.sort), asc(staff.createdAt)),
  ]);
  return {
    profile: {
      name: shop!.name,
      district: shop!.district,
      description: shop!.description ?? "",
      slug: shop!.slug,
      approved: Boolean(shop!.approvedAt),
    },
    contact: {
      phone: shop!.phone,
      address: shop!.address,
      notifyPhone: shop!.notifyPhone,
      reviewUrl: shop!.reviewUrl ?? "",
    },
    rules: {
      slotMinutes: shop!.slotMinutes,
      bufferMinutes: shop!.bufferMinutes,
      minNoticeMinutes: shop!.minNoticeMinutes,
      bookAheadDays: shop!.bookAheadDays,
      reminderMinutesBefore: shop!.reminderMinutesBefore,
      thanksMinutesAfter: shop!.thanksMinutesAfter,
    },
    lunch: shop!.breakStart && shop!.breakEnd ? { start: hhmm(shop!.breakStart), end: hhmm(shop!.breakEnd) } : null,
    /** 0 = Pazar ... 6 = Cumartesi; kapalı gün null. */
    week: [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
      const h = hours.find((x) => x.weekday === weekday);
      return { weekday, hours: h ? { opens: hhmm(h.opens), closes: hhmm(h.closes) } : null };
    }),
    services: serviceRows.map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      priceKurus: s.priceKurus,
      active: s.active,
    })),
    staff: staffRows.map((s) => ({ id: s.id, name: s.name, active: s.active })),
  };
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;

/** Haftalık çalışma saatleri ve öğle arası. */
export async function saveHours(
  db: Db,
  shopId: string,
  input: {
    week: { weekday: number; hours: { opens: string; closes: string } | null }[];
    lunch: { start: string; end: string } | null;
  },
) {
  const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  for (const d of input.week) {
    if (!d.hours) continue;
    if (!validTime(d.hours.opens) || !validTime(d.hours.closes)) fail(`${DAYS[d.weekday]}: saat geçersiz.`);
    if (toMinutes(d.hours.opens) >= toMinutes(d.hours.closes)) fail(`${DAYS[d.weekday]}: kapanış açılıştan sonra olmalı.`);
  }
  if (!input.week.some((d) => d.hours)) fail("En az bir gün açık olmalı.");
  if (input.lunch) {
    if (!validTime(input.lunch.start) || !validTime(input.lunch.end)) fail("Öğle arası saati geçersiz.");
    if (toMinutes(input.lunch.start) >= toMinutes(input.lunch.end)) fail("Öğle arasının bitişi başlangıcından sonra olmalı.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(workingHours).where(eq(workingHours.shopId, shopId));
    const open = input.week.filter((d) => d.hours);
    await tx.insert(workingHours).values(open.map((d) => ({ shopId, weekday: d.weekday, opens: d.hours!.opens, closes: d.hours!.closes })));
    await tx
      .update(shops)
      .set({ breakStart: input.lunch?.start ?? null, breakEnd: input.lunch?.end ?? null })
      .where(eq(shops.id, shopId));
  });
}

const ALLOWED = {
  slotMinutes: [10, 15, 20, 30, 60],
  bufferMinutes: [0, 5, 10, 15, 20, 30],
  minNoticeMinutes: [0, 15, 30, 60, 120, 180, 1440],
  bookAheadDays: [7, 14, 21, 30, 60],
  reminderMinutesBefore: [30, 60, 120, 180, 1440],
  thanksMinutesAfter: [0, 15, 30, 60, 120, 180],
} as const;
export const RULE_OPTIONS = ALLOWED;

export async function saveRules(db: Db, shopId: string, rules: Settings["rules"]) {
  for (const [key, allowed] of Object.entries(ALLOWED)) {
    if (!(allowed as readonly number[]).includes(rules[key as keyof typeof rules])) fail("Seçilen değerlerden biri geçersiz.");
  }
  await db.update(shops).set(rules).where(eq(shops.id, shopId));
}

export const MAX_DESCRIPTION = 300;

/** Müşteri sayfasında görünen dükkân adı, ilçe ve kısa tanıtım. Sayfa adresi (slug) değişmez. */
export async function saveProfile(
  db: Db,
  shopId: string,
  input: { name: string; district: string; description: string },
) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const district = input.district.trim();
  const description = input.description.trim().replace(/\n{3,}/g, "\n\n");
  if (name.length < 2 || name.length > 60) fail("Dükkân adı 2 ile 60 karakter arasında olmalı.");
  if (district.length < 2 || district.length > 40) fail("İlçeyi yazın.");
  if (description.length > MAX_DESCRIPTION) fail(`Tanıtım en fazla ${MAX_DESCRIPTION} karakter olabilir.`);
  await db
    .update(shops)
    .set({ name, district, description: description || null })
    .where(eq(shops.id, shopId));
}

export async function saveContact(db: Db, shopId: string, input: Settings["contact"]) {
  const phone = input.phone.trim();
  const address = input.address.trim();
  const notify = normalizePhone(input.notifyPhone);
  const reviewUrl = input.reviewUrl.trim();
  if (phone.length < 7) fail("Dükkân telefonunu yazın.");
  if (address.length < 5) fail("Adresi yazın.");
  if (!notify) fail("Bildirim numarası 05 ile başlayan 11 haneli bir cep telefonu olmalı.");
  if (reviewUrl && !/^https:\/\/\S+$/.test(reviewUrl)) fail("Google yorum linki https:// ile başlamalı.");
  await db
    .update(shops)
    .set({ phone, address, notifyPhone: notify!, reviewUrl: reviewUrl || null })
    .where(eq(shops.id, shopId));
}

/** Hizmet ekler ya da günceller. Silinmez, kapatılır: eski randevular bozulmasın. */
export async function saveService(
  db: Db,
  shopId: string,
  input: { id?: string; name: string; durationMinutes: number; priceKurus: number; active: boolean },
) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) fail("Hizmet adı 2 ile 60 karakter arasında olmalı.");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 240) {
    fail("Süre 5 ile 240 dakika arasında olmalı.");
  }
  if (!Number.isInteger(input.priceKurus) || input.priceKurus < 0) fail("Fiyat geçersiz.");
  const same = await db.select({ id: services.id, name: services.name }).from(services).where(eq(services.shopId, shopId));
  if (same.some((x) => x.id !== input.id && normalizeName(x.name) === normalizeName(name))) {
    fail("Bu isimde bir hizmet zaten var.");
  }
  if (input.id) {
    const [row] = await db
      .update(services)
      .set({ name, durationMinutes: input.durationMinutes, priceKurus: input.priceKurus, active: input.active })
      .where(and(eq(services.id, input.id), eq(services.shopId, shopId)))
      .returning({ id: services.id });
    if (!row) fail("Hizmet bulunamadı.");
    if (!input.active) {
      const stillOpen = await db
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.shopId, shopId), eq(services.active, true)));
      if (stillOpen.length === 0) {
        await db.update(services).set({ active: true }).where(eq(services.id, input.id));
        fail("En az bir hizmet açık kalmalı.");
      }
    }
    return;
  }
  const count = (await db.select({ id: services.id }).from(services).where(eq(services.shopId, shopId))).length;
  await db.insert(services).values({ shopId, name, durationMinutes: input.durationMinutes, priceKurus: input.priceKurus, active: true, sort: count });
}

/**
 * Usta ekler ya da günceller. Kapatılan usta yeni randevu almaz; alınmış
 * randevuları durur. Dönen sayı, kapatılan ustanın yaklaşan randevularıdır.
 */
export async function saveStaff(
  db: Db,
  shopId: string,
  input: { id?: string; name: string; active: boolean },
  now: Date = new Date(),
): Promise<{ upcoming: number }> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 40) fail("Usta adı 2 ile 40 karakter arasında olmalı.");
  const same = await db.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.shopId, shopId));
  if (same.some((x) => x.id !== input.id && normalizeName(x.name) === normalizeName(name))) {
    fail("Bu isimde bir usta zaten var.");
  }
  if (!input.id) {
    const count = (await db.select({ id: staff.id }).from(staff).where(eq(staff.shopId, shopId))).length;
    await db.insert(staff).values({ shopId, name, active: true, sort: count });
    return { upcoming: 0 };
  }
  if (!input.active) {
    const others = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.shopId, shopId), eq(staff.active, true)));
    if (others.filter((o) => o.id !== input.id).length === 0) fail("En az bir usta açık kalmalı.");
  }
  const [row] = await db
    .update(staff)
    .set({ name, active: input.active })
    .where(and(eq(staff.id, input.id), eq(staff.shopId, shopId)))
    .returning({ id: staff.id });
  if (!row) fail("Usta bulunamadı.");
  if (input.active) return { upcoming: 0 };
  const upcoming = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(inArray(appointments.staffId, [input.id]), eq(appointments.status, "active"), gt(appointments.startsAt, now)));
  return { upcoming: upcoming.length };
}
