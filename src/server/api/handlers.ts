/**
 * API işleyicileri. Next.js'ten bağımsızdır: veritabanını ve isteği alır,
 * { status, body } döner. Böylece gerçek PostgreSQL ile test edilebilir.
 * src/app/api/... altındaki route.ts dosyaları bunları çağırır.
 */
import { z } from "zod";
import { formatTimeTr, utcToZoned } from "@/lib/domain/time";
import { BookingError, type BookingErrorCode } from "@/server/booking/errors";
import {
  cancelAppointment,
  createAppointment,
  getDaySlots,
  listUpcomingByPhone,
} from "@/server/booking/service";
import type { Db } from "@/server/db/types";
import { getPublicShop, getShopBySlug } from "@/server/shops/service";

export type ApiResult = { status: number; body: unknown };

const STATUS: Record<BookingErrorCode, number> = {
  INVALID_INPUT: 400,
  INVALID_PHONE: 400,
  NOT_FOUND: 404,
  BLOCKED: 403,
  SLOT_UNAVAILABLE: 409,
  SLOT_TAKEN: 409,
  ALREADY_CANCELLED: 409,
  TOO_LATE: 409,
};

function ok(body: unknown, status = 200): ApiResult {
  return { status, body };
}

function error(status: number, code: string, message: string): ApiResult {
  return { status, body: { error: { code, message } } };
}

/** Beklenen hataları kullanıcıya gösterilecek yanıta çevirir; diğerlerini kaydeder. */
async function run(fn: () => Promise<ApiResult>): Promise<ApiResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof BookingError) return error(STATUS[e.code], e.code, e.message);
    if (e instanceof z.ZodError) {
      return error(400, "INVALID_INPUT", e.issues[0]?.message ?? "Gönderilen bilgiler geçersiz.");
    }
    console.error("[api] beklenmeyen hata", e);
    return error(500, "INTERNAL", "Beklenmeyen bir hata oldu. Lütfen tekrar deneyin.");
  }
}

const id = z.uuid({ error: "Geçersiz kimlik." });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Tarih YYYY-AA-GG biçiminde olmalı." });
const time = z.string().regex(/^\d{2}:\d{2}$/, { error: "Saat SS:DD biçiminde olmalı." });
const phone = z.string({ error: "Telefon numarası gerekli." }).min(1, { error: "Telefon numarası gerekli." }).max(30);

/** Randevuyu müşteriye gösterilecek biçime çevirir (dükkânın saat diliminde). */
function present(
  a: { id: string; startsAt: Date; endsAt: Date; serviceName: string; priceKurus: number; staffName: string },
  timeZone: string,
) {
  return {
    id: a.id,
    date: utcToZoned(a.startsAt, timeZone).date,
    time: formatTimeTr(a.startsAt, timeZone),
    endTime: formatTimeTr(a.endsAt, timeZone),
    startsAt: a.startsAt.toISOString(),
    serviceName: a.serviceName,
    staffName: a.staffName,
    priceKurus: a.priceKurus,
  };
}

/* GET /api/shops/[slug] */
export function shopInfo(db: Db, slug: string, now = new Date()) {
  return run(async () => ok(await getPublicShop(db, slug, now)));
}

/* GET /api/shops/[slug]/slots?service=…&date=…&staff=… */
export function daySlots(db: Db, slug: string, query: URLSearchParams, now = new Date()) {
  return run(async () => {
    const params = z
      .object({ service: id, date, staff: z.union([z.literal("any"), id]).default("any") })
      .parse({
        service: query.get("service") ?? undefined,
        date: query.get("date") ?? undefined,
        staff: query.get("staff") ?? undefined,
      });
    const shop = await getShopBySlug(db, slug);
    const slots = await getDaySlots(
      db,
      { shopId: shop.id, serviceId: params.service, date: params.date, source: "online" },
      now,
    );
    return ok({
      date: params.date,
      slots: slots.map((s) => ({
        time: s.time,
        available:
          params.staff === "any" ? s.freeStaffIds.length > 0 : s.freeStaffIds.includes(params.staff),
      })),
    });
  });
}

const bookBody = z.object({
  serviceId: id,
  staffId: z.union([z.literal("any"), id]),
  date,
  time,
  name: z.string({ error: "Ad soyad gerekli." }).max(80),
  phone,
});

/* POST /api/shops/[slug]/appointments */
export function book(db: Db, slug: string, json: unknown, now = new Date()) {
  return run(async () => {
    const body = bookBody.parse(json);
    const shop = await getShopBySlug(db, slug);
    const result = await createAppointment(
      db,
      {
        shopId: shop.id,
        serviceId: body.serviceId,
        staffId: body.staffId,
        date: body.date,
        time: body.time,
        customerName: body.name,
        customerPhone: body.phone,
        source: "online",
      },
      now,
    );
    const confirmation = result.messages.find((m) => m.kind === "confirm");
    return ok(
      {
        appointment: present({ ...result.appointment, staffName: result.staffName }, shop.timezone),
        whatsappPreview: confirmation?.body ?? null,
      },
      201,
    );
  });
}

/* POST /api/shops/[slug]/appointments/lookup  { phone } */
export function lookup(db: Db, slug: string, json: unknown, now = new Date()) {
  return run(async () => {
    const body = z.object({ phone }).parse(json);
    const shop = await getShopBySlug(db, slug);
    const rows = await listUpcomingByPhone(db, { shopId: shop.id, phone: body.phone }, now);
    return ok({ appointments: rows.map((r) => present(r, shop.timezone)) });
  });
}

/* POST /api/shops/[slug]/appointments/[id]/cancel  { phone } */
export function cancel(db: Db, slug: string, appointmentId: string, json: unknown, now = new Date()) {
  return run(async () => {
    const body = z.object({ phone }).parse(json);
    const apptId = id.safeParse(appointmentId);
    if (!apptId.success) return error(404, "NOT_FOUND", "Randevu bulunamadı.");
    const shop = await getShopBySlug(db, slug);
    const result = await cancelAppointment(
      db,
      { shopId: shop.id, appointmentId: apptId.data, by: "customer", customerPhone: body.phone },
      now,
    );
    const notice = result.messages.find((m) => m.kind === "cancel_customer");
    return ok({ cancelled: true, whatsappPreview: notice?.body ?? null });
  });
}
