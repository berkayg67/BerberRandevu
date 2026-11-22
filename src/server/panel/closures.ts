/**
 * Tatil ve izin günleri. Kapalı günlerde müşteriler online randevu alamaz; berber yine de
 * kendi elinden randevu ekleyebilir. Var olan randevular için berber karar verir:
 * dokunulmaz ya da iptal edilip müşterilere haber verilir.
 */
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { addDays, isLocalDate, todayIn, zonedToUtc, type LocalDate } from "@/lib/domain/time";
import { BookingError } from "@/server/booking/errors";
import { cancelAppointment } from "@/server/booking/service";
import { appointments, shopClosures, shops } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

const MAX_DAYS = 120;
const MAX_NOTE = 80;

const fail = (message: string): never => {
  throw new BookingError("INVALID_INPUT", message);
};

async function timezoneOf(db: Db, shopId: string) {
  const [shop] = await db.select({ tz: shops.timezone }).from(shops).where(eq(shops.id, shopId));
  if (!shop) fail("Dükkân bulunamadı.");
  return shop!.tz;
}

function daysBetween(from: LocalDate, to: LocalDate) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Bitmemiş (bugün dahil gelecekteki) kapalı günler, tarih sırasıyla. */
export async function listClosures(db: Db, shopId: string, now: Date = new Date()) {
  const today = todayIn(await timezoneOf(db, shopId), now);
  return db
    .select({ id: shopClosures.id, startsOn: shopClosures.startsOn, endsOn: shopClosures.endsOn, note: shopClosures.note })
    .from(shopClosures)
    .where(and(eq(shopClosures.shopId, shopId), gte(shopClosures.endsOn, today)))
    .orderBy(asc(shopClosures.startsOn));
}

/** Aralıktaki yaklaşan aktif randevu sayısı (uyarı göstermek için). */
export async function countAppointmentsIn(db: Db, shopId: string, from: LocalDate, to: LocalDate, now: Date = new Date()) {
  const tz = await timezoneOf(db, shopId);
  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.shopId, shopId),
        eq(appointments.status, "active"),
        gte(appointments.startsAt, zonedToUtc(from, 0, tz)),
        lt(appointments.startsAt, zonedToUtc(addDays(to, 1), 0, tz)),
        sql`${appointments.endsAt} > ${now.toISOString()}`,
      ),
    );
  return rows.map((r) => r.id);
}

export async function addClosure(
  db: Db,
  input: { shopId: string; from: string; to: string; note?: string; cancelExisting?: boolean },
  now: Date = new Date(),
) {
  const tz = await timezoneOf(db, input.shopId);
  const today = todayIn(tz, now);
  if (!isLocalDate(input.from) || !isLocalDate(input.to)) fail("Tarihleri seçin.");
  const to = input.to || input.from;
  if (to < input.from) fail("Bitiş tarihi başlangıçtan önce olamaz.");
  if (to < today) fail("Geçmiş tarihler kapatılamaz.");
  if (daysBetween(input.from, to) > MAX_DAYS) fail(`En fazla ${MAX_DAYS} gün art arda kapatabilirsiniz.`);
  const note = (input.note ?? "").trim();
  if (note.length > MAX_NOTE) fail(`Not en fazla ${MAX_NOTE} karakter olabilir.`);
  const from = input.from < today ? today : input.from;

  const affected = await countAppointmentsIn(db, input.shopId, from, to, now);
  await db.insert(shopClosures).values({ shopId: input.shopId, startsOn: input.from, endsOn: to, note: note || null });
  let cancelled = 0;
  if (input.cancelExisting) {
    for (const id of affected) {
      await cancelAppointment(db, { shopId: input.shopId, appointmentId: id, by: "shop" }, now);
      cancelled++;
    }
  }
  return { affected: affected.length, cancelled };
}

export async function removeClosure(db: Db, shopId: string, id: string) {
  await db.delete(shopClosures).where(and(eq(shopClosures.id, id), eq(shopClosures.shopId, shopId)));
}
