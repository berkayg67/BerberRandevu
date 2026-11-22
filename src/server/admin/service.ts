import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { normalizePhone } from "@/lib/domain/phone";
import { periodOf, periodsBetween, type Period } from "@/lib/domain/period";
import { slugify } from "@/lib/domain/slug";
import { todayIn } from "@/lib/domain/time";
import { DEFAULT_HOURS, DEFAULT_SERVICES } from "@/server/db/demo-shop";
import { appointments, payments, services, shops, staff, workingHours } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

const TZ = "Europe/Istanbul";

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

type PaymentRow = typeof payments.$inferSelect;

/** Bir dükkânın tahsilat durumu: hangi aylar ödendi, kaç ay ve ne kadar bekliyor. */
function billingStatus(
  shop: { billingStart: string; monthlyFeeKurus: number; active: boolean },
  paid: PaymentRow[],
  currentPeriod: Period,
) {
  const start = periodOf(shop.billingStart);
  const due = start <= currentPeriod ? periodsBetween(start, currentPeriod) : [];
  const paidPeriods = new Set(paid.map((p) => p.period));
  const unpaid = shop.monthlyFeeKurus > 0 ? due.filter((p) => !paidPeriods.has(p)) : [];
  return {
    currentPaid: paidPeriods.has(currentPeriod),
    currentDue: due.includes(currentPeriod) && shop.monthlyFeeKurus > 0,
    unpaidPeriods: unpaid,
    unpaidKurus: unpaid.length * shop.monthlyFeeKurus,
  };
}

/** Yönetim ana sayfası: tüm dükkânlar, tahsilat durumu ve son 30 günün randevu sayısı. */
export async function listShopsOverview(db: Db, now: Date = new Date()) {
  const currentPeriod = periodOf(todayIn(TZ, now));
  const rows = await db.select().from(shops).orderBy(desc(shops.createdAt));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    return { currentPeriod, shops: [], totals: { active: 0, collectedThisMonthKurus: 0, outstandingKurus: 0 } };
  }

  const [paidRows, recent] = await Promise.all([
    db.select().from(payments).where(inArray(payments.shopId, ids)),
    db
      .select({ shopId: appointments.shopId, n: count() })
      .from(appointments)
      .where(
        and(
          inArray(appointments.shopId, ids),
          eq(appointments.status, "active"),
          gte(appointments.startsAt, new Date(now.getTime() - 30 * 86_400_000)),
        ),
      )
      .groupBy(appointments.shopId),
  ]);

  const list = rows.map((shop) => {
    const paid = paidRows.filter((p) => p.shopId === shop.id);
    return {
      id: shop.id,
      slug: shop.slug,
      name: shop.name,
      district: shop.district,
      ownerName: shop.ownerName,
      active: shop.active,
      monthlyFeeKurus: shop.monthlyFeeKurus,
      appointmentsLast30Days: Number(recent.find((r) => r.shopId === shop.id)?.n ?? 0),
      ...billingStatus(shop, paid, currentPeriod),
    };
  });

  return {
    currentPeriod,
    shops: list,
    totals: {
      active: list.filter((s) => s.active).length,
      collectedThisMonthKurus: paidRows
        .filter((p) => p.period === currentPeriod)
        .reduce((sum, p) => sum + p.amountKurus, 0),
      outstandingKurus: list.filter((s) => s.active).reduce((sum, s) => sum + s.unpaidKurus, 0),
    },
  };
}

export type ShopsOverview = Awaited<ReturnType<typeof listShopsOverview>>;

/** Dükkân ayrıntısı: bilgiler ve başlangıçtan bu aya (ve gelecek aya) tüm dönemler. */
export async function getShopForAdmin(db: Db, shopId: string, now: Date = new Date()) {
  const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!shop) return null;
  const currentPeriod = periodOf(todayIn(TZ, now));
  const paid = await db.select().from(payments).where(eq(payments.shopId, shop.id));
  const start = periodOf(shop.billingStart);
  const last = start > currentPeriod ? start : currentPeriod;
  const periods = periodsBetween(start, last)
    .reverse()
    .map((period) => ({ period, payment: paid.find((p) => p.period === period) ?? null }));
  const [staffCount] = await db.select({ n: count() }).from(staff).where(eq(staff.shopId, shop.id));
  return {
    shop,
    currentPeriod,
    periods,
    staffCount: Number(staffCount?.n ?? 0),
    ...billingStatus(shop, paid, currentPeriod),
  };
}

export type ShopInput = {
  name: string;
  district: string;
  address: string;
  phone: string;
  notifyPhone: string;
  ownerName: string | null;
  ownerPhone: string | null;
  monthlyFeeKurus: number;
  billingStart: string;
  adminNotes: string | null;
};

function checkPhones(input: Pick<ShopInput, "notifyPhone" | "ownerPhone">) {
  const notify = normalizePhone(input.notifyPhone);
  if (!notify) throw new AdminError("Bildirim numarası 05 ile başlayan 11 haneli bir cep telefonu olmalı.");
  const owner = input.ownerPhone ? normalizePhone(input.ownerPhone) : null;
  if (input.ownerPhone && !owner) throw new AdminError("Dükkân sahibinin telefonu geçersiz.");
  return { notify, owner };
}

async function uniqueSlug(db: Db, name: string) {
  const base = slugify(name) || "berber";
  const taken = new Set(
    (await db.select({ slug: shops.slug }).from(shops)).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Yeni dükkân açar; varsayılan çalışma saatleri, hizmetler ve bir usta ile birlikte. */
export async function createShop(db: Db, input: ShopInput) {
  const { notify, owner } = checkPhones(input);
  const slug = await uniqueSlug(db, input.name);
  return db.transaction(async (tx) => {
    const [shop] = await tx
      .insert(shops)
      .values({
        slug,
        name: input.name,
        district: input.district,
        address: input.address,
        phone: input.phone,
        notifyPhone: notify,
        ownerName: input.ownerName,
        ownerPhone: owner,
        monthlyFeeKurus: input.monthlyFeeKurus,
        billingStart: input.billingStart,
        adminNotes: input.adminNotes,
      })
      .returning();
    await tx.insert(workingHours).values(DEFAULT_HOURS.map((h) => ({ ...h, shopId: shop.id })));
    await tx.insert(services).values(DEFAULT_SERVICES.map((s, sort) => ({ ...s, shopId: shop.id, sort })));
    await tx.insert(staff).values({ shopId: shop.id, name: input.ownerName?.split(" ")[0] || "Usta", sort: 0 });
    return shop;
  });
}

export async function updateShop(db: Db, shopId: string, input: ShopInput & { active: boolean }) {
  const { notify, owner } = checkPhones(input);
  const [shop] = await db
    .update(shops)
    .set({
      name: input.name,
      district: input.district,
      address: input.address,
      phone: input.phone,
      notifyPhone: notify,
      ownerName: input.ownerName,
      ownerPhone: owner,
      monthlyFeeKurus: input.monthlyFeeKurus,
      billingStart: input.billingStart,
      adminNotes: input.adminNotes,
      active: input.active,
    })
    .where(eq(shops.id, shopId))
    .returning();
  if (!shop) throw new AdminError("Dükkân bulunamadı.");
  return shop;
}

export async function setShopActive(db: Db, shopId: string, active: boolean) {
  await db.update(shops).set({ active }).where(eq(shops.id, shopId));
}

/** Bir ayın tahsil edildiğini kaydeder (varsa günceller). */
export async function recordPayment(
  db: Db,
  input: {
    shopId: string;
    period: Period;
    amountKurus: number;
    method: "nakit" | "havale" | "kart" | "diger";
    note: string | null;
    recordedBy: string;
  },
  now: Date = new Date(),
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new AdminError("Dönem geçersiz.");
  if (!Number.isInteger(input.amountKurus) || input.amountKurus < 0) throw new AdminError("Tutar geçersiz.");
  const values = { ...input, paidAt: now };
  await db
    .insert(payments)
    .values(values)
    .onConflictDoUpdate({
      target: [payments.shopId, payments.period],
      set: { amountKurus: values.amountKurus, method: values.method, note: values.note, recordedBy: values.recordedBy, paidAt: now },
    });
}

/** Yanlışlıkla işaretlenen tahsilatı geri alır. */
export async function removePayment(db: Db, shopId: string, period: Period) {
  await db.delete(payments).where(and(eq(payments.shopId, shopId), eq(payments.period, period)));
}
