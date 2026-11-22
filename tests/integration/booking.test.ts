import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BookingError, isOverlapViolation } from "@/server/booking/errors";
import {
  cancelAppointment,
  createAppointment,
  getDaySlots,
  listUpcomingByPhone,
} from "@/server/booking/service";
import { appointments, blocks, messages } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createTestDb, seedShop } from "./test-db";

// Perşembe 19 Kasım 2026, 15:00 İstanbul. Randevular Cuma 20 Kasım'a alınır.
const NOW = new Date("2026-11-19T12:00:00Z");
const FRIDAY = "2026-11-20";

let db: Db;
let close: () => Promise<void>;
let ctx: Awaited<ReturnType<typeof seedShop>>;

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  close = () => t.client.close();
  ctx = await seedShop(db);
});

afterAll(async () => {
  await close?.();
});

function book(overrides: Partial<Parameters<typeof createAppointment>[1]> = {}) {
  return createAppointment(
    db,
    {
      shopId: ctx.shop.id,
      serviceId: ctx.haircut.id,
      staffId: "any",
      date: FRIDAY,
      time: "10:00",
      customerName: "Ahmet Yılmaz",
      customerPhone: "0532 123 45 67",
      source: "online",
      ...overrides,
    },
    NOW,
  );
}

async function expectBookingError(promise: Promise<unknown>, code: BookingError["code"]) {
  await expect(promise).rejects.toMatchObject({ name: "BookingError", code });
}

describe("veritabanı", () => {
  it("tüm tablolarda RLS açık (Supabase'in genel API'si erişemez)", async () => {
    // PGlite sonucu { rows } biçimindedir.
    const result = (await db.execute(sql`
      select relname from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r'
        and relname not like '__drizzle%' and not relrowsecurity`)) as unknown as { rows: unknown[] };
    expect(result.rows).toEqual([]);
  });

  it("aynı ustaya üst üste binen randevuyu veritabanı reddeder", async () => {
    const first = await book({ staffId: ctx.murat.id });
    const row = first.appointment;
    await expect(
      db.insert(appointments).values({
        shopId: row.shopId,
        staffId: row.staffId,
        serviceId: row.serviceId,
        customerId: row.customerId,
        startsAt: new Date(row.startsAt.getTime() + 10 * 60_000),
        endsAt: new Date(row.endsAt.getTime() + 10 * 60_000),
        blockedUntil: new Date(row.blockedUntil.getTime() + 10 * 60_000),
        source: "online",
        serviceName: row.serviceName,
        priceKurus: row.priceKurus,
      }),
    ).rejects.toSatisfy(isOverlapViolation);
  });
});

describe("randevu alma", () => {
  it("randevuyu kaydeder ve dört mesajı kuyruğa yazar", async () => {
    const result = await book();
    expect(result.appointment.startsAt.toISOString()).toBe("2026-11-20T07:00:00.000Z");
    expect(result.appointment.endsAt.toISOString()).toBe("2026-11-20T07:30:00.000Z");
    expect(result.appointment.blockedUntil.toISOString()).toBe("2026-11-20T07:35:00.000Z");
    expect(result.appointment.serviceName).toBe("Saç kesimi");
    expect(result.customer.phone).toBe("5321234567");
    expect(result.messages.map((m) => m.kind).sort()).toEqual(
      ["confirm", "new_booking", "reminder", "thanks"].sort(),
    );
    expect(result.messages.every((m) => m.status === "scheduled")).toBe(true);
  });

  it("aynı saate ikinci müşteri gelirse diğer usta atanır, üçüncüsü reddedilir", async () => {
    const a = await book();
    const b = await book({ customerName: "Mehmet Kaya", customerPhone: "05331112233" });
    expect(a.staffName).toBe("Murat");
    expect(b.staffName).toBe("Emre");
    await expectBookingError(
      book({ customerName: "Can Aksoy", customerPhone: "05351112233" }),
      "SLOT_TAKEN",
    );
  });

  it("seçilen usta doluysa SLOT_TAKEN döner", async () => {
    await book({ staffId: ctx.murat.id });
    await expectBookingError(
      book({ staffId: ctx.murat.id, customerPhone: "05331112233", customerName: "Mehmet Kaya" }),
      "SLOT_TAKEN",
    );
  });

  it("randevular arası boşluğu korur", async () => {
    await book({ staffId: ctx.murat.id }); // 10:00–10:30, 10:35'e kadar dolu
    const slots = await getDaySlots(
      db,
      { shopId: ctx.shop.id, serviceId: ctx.haircut.id, date: FRIDAY, source: "online" },
      NOW,
    );
    const free = (t: string) => slots.find((s) => s.time === t)?.freeStaffIds ?? [];
    expect(free("10:30")).not.toContain(ctx.murat.id);
    expect(free("10:45")).toContain(ctx.murat.id);
  });

  it("öğle arasına, kapalı güne ve geçmiş saate randevu verilmez", async () => {
    await expectBookingError(book({ time: "13:15" }), "SLOT_UNAVAILABLE");
    await expectBookingError(book({ date: "2026-11-22" }), "SLOT_UNAVAILABLE"); // Pazar
    await expectBookingError(book({ date: "2026-11-19", time: "15:15" }), "SLOT_UNAVAILABLE");
  });

  it("14 günden ileriye online randevu verilmez", async () => {
    await expectBookingError(book({ date: "2026-12-05" }), "SLOT_UNAVAILABLE");
  });

  it("geçersiz telefonu reddeder", async () => {
    await expectBookingError(book({ customerPhone: "0212 123 45 67" }), "INVALID_PHONE");
  });

  it("aynı numarayla gelen müşteri tek kayıtta kalır, adı güncellenir", async () => {
    const a = await book();
    const b = await book({ time: "11:00", customerName: "Ahmet Y." });
    expect(b.customer.id).toBe(a.customer.id);
    expect(b.customer.name).toBe("Ahmet Y.");
  });
});

describe("engelleme", () => {
  it("telefonla engellenen kişi online randevu alamaz", async () => {
    await db.insert(blocks).values({ shopId: ctx.shop.id, phone: "5321234567", note: "gelmedi" });
    await expectBookingError(book({ customerName: "Başka İsim" }), "BLOCKED");
  });

  it("isimle engellenen kişi büyük-küçük harf farkıyla da yakalanır", async () => {
    await db.insert(blocks).values({ shopId: ctx.shop.id, name: "ahmet yılmaz" });
    await expectBookingError(book({ customerName: "AHMET  YILMAZ" }), "BLOCKED");
  });

  it("dükkân engelli kişiye bilerek randevu ekleyebilir", async () => {
    await db.insert(blocks).values({ shopId: ctx.shop.id, phone: "5321234567" });
    await expectBookingError(book({ source: "panel" }), "BLOCKED");
    const ok = await book({ source: "panel", allowBlocked: true });
    expect(ok.appointment.source).toBe("panel");
  });
});

describe("iptal", () => {
  it("yanlış telefonla iptal edilemez ve randevunun varlığı açığa çıkmaz", async () => {
    const { appointment } = await book();
    await expectBookingError(
      cancelAppointment(
        db,
        { shopId: ctx.shop.id, appointmentId: appointment.id, by: "customer", customerPhone: "05331112233" },
        NOW,
      ),
      "NOT_FOUND",
    );
  });

  it("iptal edince bekleyen mesajlar durur, iki bildirim eklenir ve saat boşalır", async () => {
    const { appointment } = await book({ staffId: ctx.murat.id });
    const result = await cancelAppointment(
      db,
      { shopId: ctx.shop.id, appointmentId: appointment.id, by: "customer", customerPhone: "05321234567" },
      NOW,
    );
    expect(result.appointment.status).toBe("cancelled");
    expect(result.appointment.cancelledBy).toBe("customer");

    const rows = await db.select().from(messages).where(eq(messages.appointmentId, appointment.id));
    const status = (kind: string) => rows.find((m) => m.kind === kind)?.status;
    expect(status("reminder")).toBe("cancelled");
    expect(status("thanks")).toBe("cancelled");
    expect(status("cancel_customer")).toBe("scheduled");
    expect(status("cancel_shop")).toBe("scheduled");
    expect(rows.find((m) => m.kind === "cancel_shop")?.body).toContain("müşteri iptal etti");

    const again = await book({ staffId: ctx.murat.id, customerPhone: "05331112233", customerName: "Mehmet Kaya" });
    expect(again.staffName).toBe("Murat");
  });

  it("iki kez iptal edilemez", async () => {
    const { appointment } = await book();
    const input = { shopId: ctx.shop.id, appointmentId: appointment.id, by: "shop" as const };
    await cancelAppointment(db, input, NOW);
    await expectBookingError(cancelAppointment(db, input, NOW), "ALREADY_CANCELLED");
  });
});

describe("Randevularım", () => {
  it("telefona ait aktif ve bitmemiş randevuları sıralı döner", async () => {
    await book({ time: "11:00" });
    const early = await book({ time: "09:30" });
    const other = await book({ time: "10:00", customerPhone: "05331112233", customerName: "Mehmet Kaya" });
    const cancelled = await book({ time: "15:00" });
    await cancelAppointment(db, { shopId: ctx.shop.id, appointmentId: cancelled.appointment.id, by: "shop" }, NOW);

    const list = await listUpcomingByPhone(db, { shopId: ctx.shop.id, phone: "+90 532 123 45 67" }, NOW);
    expect(list.map((a) => a.id)).not.toContain(other.appointment.id);
    expect(list.map((a) => a.id)).not.toContain(cancelled.appointment.id);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(early.appointment.id);
    expect(list[0].staffName).toBeTruthy();

    const later = await listUpcomingByPhone(
      db,
      { shopId: ctx.shop.id, phone: "05321234567" },
      new Date("2026-11-20T08:45:00Z"), // 11:45: ikisi de bitmiş (son randevu 11:30'da bitti)
    );
    expect(later).toHaveLength(0);
  });
});
