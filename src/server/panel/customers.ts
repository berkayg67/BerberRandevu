import { and, asc, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { normalizeName } from "@/lib/domain/names";
import { normalizePhone } from "@/lib/domain/phone";
import { BookingError } from "@/server/booking/errors";
import { cancelAppointment } from "@/server/booking/service";
import { appointments, blocks, customers, staff } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

type BlockRow = { id: string; name: string | null; phone: string | null; note: string | null };

function findBlock(list: BlockRow[], name: string, phone: string) {
  const n = normalizeName(name);
  return list.find((b) => (b.phone && b.phone === phone) || (b.name && normalizeName(b.name) === n)) ?? null;
}

/** Müşteri listesi ve her birinin özeti. Arama isim ya da telefonla yapılır. */
export async function listCustomers(db: Db, shopId: string, query = "", now: Date = new Date()) {
  const q = query.trim();
  const digits = q.replace(/\D/g, "").replace(/^0/, "");
  const search =
    q.length === 0
      ? undefined
      : digits.length >= 3
        ? sql`${customers.phone} like ${"%" + digits + "%"}`
        : ilike(customers.name, `%${q}%`);

  // Ham SQL içinde tarih metin olarak verilir (sürücü Date nesnesini burada çeviremez).
  const nowIso = now.toISOString();
  const ended = sql`${appointments.endsAt} <= ${nowIso}`;
  const active = sql`${appointments.status} = 'active'`;
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      visits: sql<number>`count(*) filter (where ${active} and ${ended} and not ${appointments.noShow})`.mapWith(Number),
      noShows: sql<number>`count(*) filter (where ${active} and ${appointments.noShow})`.mapWith(Number),
      upcoming: sql<number>`count(*) filter (where ${active} and ${appointments.endsAt} > ${nowIso})`.mapWith(Number),
      lastAt: sql<Date | null>`max(${appointments.startsAt}) filter (where ${active} and ${ended} and not ${appointments.noShow})`.mapWith(
        (v) => (v ? new Date(v) : null),
      ),
      nextAt: sql<Date | null>`min(${appointments.startsAt}) filter (where ${active} and ${appointments.endsAt} > ${nowIso})`.mapWith(
        (v) => (v ? new Date(v) : null),
      ),
    })
    .from(customers)
    .leftJoin(appointments, eq(appointments.customerId, customers.id))
    .where(and(eq(customers.shopId, shopId), search))
    .groupBy(customers.id)
    .orderBy(desc(sql`coalesce(max(${appointments.startsAt}), ${customers.createdAt})`))
    .limit(200);

  const blockList = await db.select().from(blocks).where(eq(blocks.shopId, shopId));
  return rows.map((r) => ({ ...r, blocked: findBlock(blockList, r.name, r.phone) !== null }));
}

export type CustomerListItem = Awaited<ReturnType<typeof listCustomers>>[number];

/** Müşteri ayrıntısı: özet, son randevular, engel durumu. */
export async function getCustomer(db: Db, shopId: string, customerId: string, now: Date = new Date()) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.shopId, shopId)));
  if (!customer) return null;

  const history = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      noShow: appointments.noShow,
      serviceName: appointments.serviceName,
      priceKurus: appointments.priceKurus,
      staffName: staff.name,
      endsAt: appointments.endsAt,
    })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(eq(appointments.customerId, customer.id))
    .orderBy(desc(appointments.startsAt))
    .limit(30);

  const blockList = await db.select().from(blocks).where(eq(blocks.shopId, shopId));
  const done = history.filter((h) => h.status === "active" && h.endsAt <= now && !h.noShow);
  return {
    customer,
    block: findBlock(blockList, customer.name, customer.phone),
    stats: {
      visits: done.length,
      noShows: history.filter((h) => h.status === "active" && h.noShow).length,
      spentKurus: done.reduce((s, h) => s + h.priceKurus, 0),
      upcoming: history.filter((h) => h.status === "active" && h.endsAt > now).length,
    },
    history: history.map((h) => ({ ...h, past: h.endsAt <= now })),
  };
}

/**
 * Müşteriyi engeller (isim ve/veya telefonla). Yaklaşan randevuları dükkân
 * tarafından iptal edilir; müşteriye ve dükkâna normal iptal bildirimi gider.
 */
export async function blockCustomer(
  db: Db,
  input: { shopId: string; name?: string | null; phone?: string | null; note?: string | null },
  now: Date = new Date(),
) {
  const name = input.name?.trim() || null;
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (input.phone?.trim() && !phone) throw new BookingError("INVALID_PHONE", "Telefon numarası geçersiz.");
  if (!name && !phone) throw new BookingError("INVALID_INPUT", "İsim ya da telefon yazın.");

  const [block] = await db
    .insert(blocks)
    .values({ shopId: input.shopId, name, phone, note: input.note?.trim() || null })
    .returning();

  const upcoming = await db
    .select({ id: appointments.id })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .where(
      and(
        eq(appointments.shopId, input.shopId),
        eq(appointments.status, "active"),
        gt(appointments.startsAt, now),
        or(
          phone ? eq(customers.phone, phone) : sql`false`,
          name ? sql`lower(${customers.name}) = lower(${name})` : sql`false`,
        ),
      ),
    );
  for (const a of upcoming) {
    await cancelAppointment(db, { shopId: input.shopId, appointmentId: a.id, by: "shop" }, now);
  }
  return { block, cancelled: upcoming.length };
}

export async function unblock(db: Db, shopId: string, blockId: string) {
  await db.delete(blocks).where(and(eq(blocks.id, blockId), eq(blocks.shopId, shopId)));
}

export async function listBlocks(db: Db, shopId: string) {
  return db.select().from(blocks).where(eq(blocks.shopId, shopId)).orderBy(asc(blocks.createdAt));
}
