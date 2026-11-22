/**
 * Berber paneli işlemleri. Her fonksiyon dükkân kimliğini (shopId) alır ve
 * yalnızca o dükkânın verisine dokunur; kimlik oturumdan gelir, istekten değil.
 */
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { addDays, formatTimeTr, todayIn, zonedToUtc, type LocalDate } from "@/lib/domain/time";
import { BookingError } from "@/server/booking/errors";
import { appointments, customers, messages, services, shops, staff } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export async function getPanelShop(db: Db, shopId: string, now: Date = new Date()) {
  const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!shop) throw new BookingError("NOT_FOUND", "Dükkân bulunamadı.");
  const [staffRows, serviceRows] = await Promise.all([
    db
      .select({ id: staff.id, name: staff.name, active: staff.active })
      .from(staff)
      .where(eq(staff.shopId, shopId))
      .orderBy(asc(staff.sort), asc(staff.createdAt)),
    db
      .select({
        id: services.id,
        name: services.name,
        durationMinutes: services.durationMinutes,
        priceKurus: services.priceKurus,
        active: services.active,
      })
      .from(services)
      .where(eq(services.shopId, shopId))
      .orderBy(asc(services.sort), asc(services.createdAt)),
  ]);
  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    district: shop.district,
    timezone: shop.timezone,
    active: shop.active,
    today: todayIn(shop.timezone, now),
    bookAheadDays: shop.bookAheadDays,
    staff: staffRows,
    services: serviceRows,
  };
}

export type PanelShop = Awaited<ReturnType<typeof getPanelShop>>;

/** Bir günün tüm randevuları (iptaller dahil), saat sırasıyla. */
export async function listDayAppointments(
  db: Db,
  shopId: string,
  date: LocalDate,
  timeZone: string,
  now: Date = new Date(),
) {
  const from = zonedToUtc(date, 0, timeZone);
  const to = zonedToUtc(addDays(date, 1), 0, timeZone);
  const rows = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      source: appointments.source,
      noShow: appointments.noShow,
      cancelledBy: appointments.cancelledBy,
      serviceName: appointments.serviceName,
      priceKurus: appointments.priceKurus,
      staffName: staff.name,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .where(and(eq(appointments.shopId, shopId), gte(appointments.startsAt, from), lt(appointments.startsAt, to)))
    .orderBy(asc(appointments.startsAt));

  const list = rows.map((r) => ({
    ...r,
    time: formatTimeTr(r.startsAt, timeZone),
    endTime: formatTimeTr(r.endsAt, timeZone),
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    /** Randevu bitti mi (gelmedi işaretlenebilir mi)? */
    past: r.endsAt <= now,
    started: r.startsAt <= now,
  }));
  const active = list.filter((a) => a.status === "active");
  return {
    appointments: list,
    summary: {
      count: active.length,
      expectedKurus: active.filter((a) => !a.noShow).reduce((s, a) => s + a.priceKurus, 0),
      cancelled: list.length - active.length,
      noShow: active.filter((a) => a.noShow).length,
    },
  };
}

export type DayAppointment = Awaited<ReturnType<typeof listDayAppointments>>["appointments"][number];

/**
 * "Gelmedi" işareti. Yalnızca başlamış randevularda kullanılabilir.
 * İşaretlenince teşekkür mesajı gönderilmez; geri alınırsa (henüz zamanı
 * gelmediyse) yeniden planlanır.
 */
export async function setNoShow(
  db: Db,
  input: { shopId: string; appointmentId: string; noShow: boolean },
  now: Date = new Date(),
) {
  const [appt] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, input.appointmentId), eq(appointments.shopId, input.shopId)));
  if (!appt) throw new BookingError("NOT_FOUND", "Randevu bulunamadı.");
  if (appt.status !== "active") throw new BookingError("ALREADY_CANCELLED", "İptal edilmiş randevu işaretlenemez.");
  if (appt.startsAt > now) throw new BookingError("TOO_LATE", "Randevu saati gelmeden işaretlenemez.");

  await db.transaction(async (tx) => {
    await tx.update(appointments).set({ noShow: input.noShow }).where(eq(appointments.id, appt.id));
    const thanks = and(eq(messages.appointmentId, appt.id), eq(messages.kind, "thanks"));
    if (input.noShow) {
      await tx
        .update(messages)
        .set({ status: "cancelled" })
        .where(and(thanks, eq(messages.status, "scheduled")));
    } else {
      await tx
        .update(messages)
        .set({ status: "scheduled" })
        .where(and(thanks, eq(messages.status, "cancelled"), gte(messages.sendAt, now)));
    }
  });
}
