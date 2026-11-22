import { and, asc, eq, gt, lt } from "drizzle-orm";
import { computeSlots, type Slot } from "@/lib/domain/availability";
import {
  planBookingMessages,
  planCancellationMessages,
  type AppointmentFacts,
  type MessageDraft,
} from "@/lib/domain/messages";
import { normalizeName } from "@/lib/domain/names";
import { normalizePhone } from "@/lib/domain/phone";
import {
  addDays,
  isLocalDate,
  todayIn,
  toMinutes,
  weekdayOf,
  zonedToUtc,
  type LocalDate,
} from "@/lib/domain/time";
import {
  appointments,
  blocks,
  customers,
  messages,
  services,
  shops,
  staff,
  workingHours,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { BookingError, isOverlapViolation } from "./errors";

type Shop = typeof shops.$inferSelect;
type Service = typeof services.$inferSelect;
type Appointment = typeof appointments.$inferSelect;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

async function getShop(db: Db, shopId: string): Promise<Shop> {
  const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!shop) throw new BookingError("NOT_FOUND", "Dükkân bulunamadı.");
  return shop;
}

async function getActiveService(db: Db, shopId: string, serviceId: string): Promise<Service> {
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.shopId, shopId), eq(services.active, true)));
  if (!service) throw new BookingError("NOT_FOUND", "Hizmet bulunamadı.");
  return service;
}

/** Müşteri bu dükkânda isim ya da telefonla engellenmiş mi? */
export async function isCustomerBlocked(
  db: Db,
  shopId: string,
  name: string,
  phone: string,
): Promise<boolean> {
  const rows = await db
    .select({ name: blocks.name, phone: blocks.phone })
    .from(blocks)
    .where(eq(blocks.shopId, shopId));
  const n = normalizeName(name);
  return rows.some(
    (b) => (b.phone !== null && b.phone === phone) || (b.name !== null && normalizeName(b.name) === n),
  );
}

/** Bir günün boş ve dolu saatleri. */
export async function getDaySlots(
  db: Db,
  params: {
    shopId: string;
    serviceId: string;
    date: LocalDate;
    /** Dükkândan eklenen randevularda "en geç ne zaman" kuralı uygulanmaz. */
    source: "online" | "panel";
  },
  now: Date = new Date(),
): Promise<Slot[]> {
  if (!isLocalDate(params.date)) throw new BookingError("INVALID_INPUT", "Tarih geçersiz.");
  const shop = await getShop(db, params.shopId);
  const service = await getActiveService(db, shop.id, params.serviceId);

  const today = todayIn(shop.timezone, now);
  if (params.date < today) return [];
  if (params.source === "online" && params.date > addDays(today, shop.bookAheadDays - 1)) return [];

  const [hours] = await db
    .select()
    .from(workingHours)
    .where(and(eq(workingHours.shopId, shop.id), eq(workingHours.weekday, weekdayOf(params.date))));
  if (!hours) return [];

  const staffRows = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.shopId, shop.id), eq(staff.active, true)))
    .orderBy(asc(staff.sort), asc(staff.createdAt));

  // O güne değen aktif randevular (önceki günden taşan boşluk dahil).
  const dayStart = zonedToUtc(params.date, 0, shop.timezone);
  const dayEnd = zonedToUtc(addDays(params.date, 1), 0, shop.timezone);
  const busy = await db
    .select({
      staffId: appointments.staffId,
      startsAt: appointments.startsAt,
      blockedUntil: appointments.blockedUntil,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.shopId, shop.id),
        eq(appointments.status, "active"),
        lt(appointments.startsAt, dayEnd),
        gt(appointments.blockedUntil, dayStart),
      ),
    );

  return computeSlots({
    date: params.date,
    timeZone: shop.timezone,
    hours: { opens: toMinutes(hours.opens), closes: toMinutes(hours.closes) },
    lunch:
      shop.breakStart && shop.breakEnd
        ? { start: toMinutes(shop.breakStart), end: toMinutes(shop.breakEnd) }
        : null,
    slotMinutes: shop.slotMinutes,
    bufferMinutes: shop.bufferMinutes,
    minNoticeMinutes: params.source === "online" ? shop.minNoticeMinutes : 0,
    durationMinutes: service.durationMinutes,
    staffIds: staffRows.map((s) => s.id),
    busy,
    now,
  });
}

/* ------------------------------------------------------------------ */
/* Randevu oluşturma                                                   */
/* ------------------------------------------------------------------ */

export type CreateAppointmentInput = {
  shopId: string;
  serviceId: string;
  /** Usta kimliği ya da "any" (ilk boş usta). */
  staffId: string;
  date: LocalDate;
  /** "09:30" */
  time: string;
  customerName: string;
  customerPhone: string;
  source: "online" | "panel";
  /** Dükkân engelli bir müşteriye yine de randevu verebilir. */
  allowBlocked?: boolean;
};

export async function createAppointment(
  db: Db,
  input: CreateAppointmentInput,
  now: Date = new Date(),
) {
  const name = input.customerName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    throw new BookingError("INVALID_INPUT", "Ad soyad 2 ile 80 karakter arasında olmalı.");
  }
  const phone = normalizePhone(input.customerPhone);
  if (!phone) {
    throw new BookingError("INVALID_PHONE", "Cep telefonu 05 ile başlamalı ve 11 haneli olmalı.");
  }

  const shop = await getShop(db, input.shopId);
  const service = await getActiveService(db, shop.id, input.serviceId);

  if (await isCustomerBlocked(db, shop.id, name, phone)) {
    if (input.source === "online" || !input.allowBlocked) {
      throw new BookingError(
        "BLOCKED",
        `Bu bilgilerle online randevu alınamıyor. Randevu için ${shop.phone} numarasını arayın.`,
      );
    }
  }

  const slots = await getDaySlots(
    db,
    { shopId: shop.id, serviceId: service.id, date: input.date, source: input.source },
    now,
  );
  const slot = slots.find((s) => s.time === input.time);
  if (!slot) throw new BookingError("SLOT_UNAVAILABLE", "Bu saat randevuya açık değil.");

  const candidates =
    input.staffId === "any"
      ? slot.freeStaffIds
      : slot.freeStaffIds.filter((id) => id === input.staffId);
  if (candidates.length === 0) {
    throw new BookingError("SLOT_TAKEN", "Bu saat dolu. Başka bir saat seçin.");
  }

  const startsAt = slot.startsAt;
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  const blockedUntil = new Date(endsAt.getTime() + shop.bufferMinutes * 60_000);

  return db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({ shopId: shop.id, name, phone })
      .onConflictDoUpdate({ target: [customers.shopId, customers.phone], set: { name } })
      .returning();

    // Seçilen usta aynı anda gelen başka bir istekle dolmuş olabilir:
    // veritabanı kuralı reddederse sıradaki boş ustayı dene.
    let appointment: Appointment | undefined;
    for (const staffId of candidates) {
      try {
        appointment = await tx.transaction(async (savepoint) => {
          const [row] = await savepoint
            .insert(appointments)
            .values({
              shopId: shop.id,
              staffId,
              serviceId: service.id,
              customerId: customer.id,
              startsAt,
              endsAt,
              blockedUntil,
              source: input.source,
              serviceName: service.name,
              priceKurus: service.priceKurus,
            })
            .returning();
          return row;
        });
        break;
      } catch (error) {
        if (!isOverlapViolation(error)) throw error;
      }
    }
    if (!appointment) {
      throw new BookingError("SLOT_TAKEN", "Bu saat az önce doldu. Başka bir saat seçin.");
    }

    const [staffRow] = await tx
      .select({ name: staff.name })
      .from(staff)
      .where(eq(staff.id, appointment.staffId));
    const staffName = staffRow?.name ?? "";
    const drafts = planBookingMessages(
      toFacts(shop, { name, phone }, appointment, staffName),
      {
        reminderMinutesBefore: shop.reminderMinutesBefore,
        thanksMinutesAfter: shop.thanksMinutesAfter,
      },
      now,
    );
    const queued = await insertMessages(tx, shop.id, appointment.id, drafts);

    return { appointment, customer, staffName, messages: queued };
  });
}

/* ------------------------------------------------------------------ */
/* İptal                                                               */
/* ------------------------------------------------------------------ */

export type CancelAppointmentInput = {
  shopId: string;
  appointmentId: string;
  by: "customer" | "shop";
  /** Müşteri iptal ediyorsa randevudaki telefonla eşleşmeli. */
  customerPhone?: string;
};

export async function cancelAppointment(
  db: Db,
  input: CancelAppointmentInput,
  now: Date = new Date(),
) {
  const shop = await getShop(db, input.shopId);
  const [row] = await db
    .select({ appointment: appointments, customer: customers, staffName: staff.name })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(and(eq(appointments.id, input.appointmentId), eq(appointments.shopId, shop.id)));

  // Telefon eşleşmezse "bulunamadı" denir; başkasının randevusu olduğu açığa çıkmaz.
  const phone = input.customerPhone ? normalizePhone(input.customerPhone) : null;
  if (!row || (input.by === "customer" && phone !== row.customer.phone)) {
    throw new BookingError("NOT_FOUND", "Randevu bulunamadı.");
  }
  if (row.appointment.status === "cancelled") {
    throw new BookingError("ALREADY_CANCELLED", "Bu randevu zaten iptal edilmiş.");
  }
  if (row.appointment.endsAt <= now) {
    throw new BookingError("TOO_LATE", "Geçmiş bir randevu iptal edilemez.");
  }

  return db.transaction(async (tx) => {
    const [appointment] = await tx
      .update(appointments)
      .set({ status: "cancelled", cancelledAt: now, cancelledBy: input.by })
      .where(eq(appointments.id, row.appointment.id))
      .returning();

    // Henüz gitmemiş hatırlatma ve teşekkür mesajları gönderilmez.
    await tx
      .update(messages)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(messages.appointmentId, appointment.id),
          eq(messages.status, "scheduled"),
          gt(messages.sendAt, now),
        ),
      );

    const facts = toFacts(shop, row.customer, appointment, row.staffName);
    const queued = await insertMessages(
      tx,
      shop.id,
      appointment.id,
      planCancellationMessages(facts, input.by, now),
    );
    return { appointment, messages: queued };
  });
}

/* ------------------------------------------------------------------ */
/* Randevularım                                                        */
/* ------------------------------------------------------------------ */

/** Telefon numarasına ait, henüz bitmemiş aktif randevular. */
export async function listUpcomingByPhone(
  db: Db,
  params: { shopId: string; phone: string },
  now: Date = new Date(),
) {
  const phone = normalizePhone(params.phone);
  if (!phone) {
    throw new BookingError("INVALID_PHONE", "Cep telefonu 05 ile başlamalı ve 11 haneli olmalı.");
  }

  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      serviceName: appointments.serviceName,
      priceKurus: appointments.priceKurus,
      staffName: staff.name,
    })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(
      and(
        eq(appointments.shopId, params.shopId),
        eq(customers.phone, phone),
        eq(appointments.status, "active"),
        gt(appointments.endsAt, now),
      ),
    )
    .orderBy(asc(appointments.startsAt));
}

/* ------------------------------------------------------------------ */

function toFacts(
  shop: Shop,
  customer: { name: string; phone: string },
  appointment: Appointment,
  staffName: string,
): AppointmentFacts {
  return {
    shop: {
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      notifyPhone: shop.notifyPhone,
      reviewUrl: shop.reviewUrl,
      timeZone: shop.timezone,
    },
    customer,
    serviceName: appointment.serviceName,
    staffName,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    source: appointment.source,
  };
}

async function insertMessages(
  tx: Tx,
  shopId: string,
  appointmentId: string,
  drafts: MessageDraft[],
) {
  if (drafts.length === 0) return [];
  return tx
    .insert(messages)
    .values(drafts.map((d) => ({ shopId, appointmentId, ...d })))
    .returning();
}
