import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { book, cancel, daySlots, lookup, shopInfo } from "@/server/api/handlers";
import { blocks } from "@/server/db/schema";
import { seedDemoShop } from "@/server/db/demo-shop";
import type { Db } from "@/server/db/types";
import type { PublicShop } from "@/server/shops/service";
import { createTestDb } from "./test-db";

// Perşembe 19 Kasım 2026, 15:00 İstanbul.
const NOW = new Date("2026-11-19T12:00:00Z");
const SLUG = "berber-demo";

let db: Db;
let close: () => Promise<void>;
let shop: PublicShop;

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  close = () => t.client.close();
  await seedDemoShop(db);
  shop = (await shopInfo(db, SLUG, NOW)).body as PublicShop;
});

afterAll(async () => {
  await close?.();
});

const haircut = () => shop.services.find((s) => s.name === "Saç kesimi")!;
const body = (overrides: Record<string, unknown> = {}) => ({
  serviceId: haircut().id,
  staffId: "any",
  date: "2026-11-20",
  time: "10:00",
  name: "Ahmet Yılmaz",
  phone: "0532 123 45 67",
  consent: true,
  ...overrides,
});
const errorCode = (r: { body: unknown }) => (r.body as { error: { code: string } }).error.code;

describe("örnek veri", () => {
  it("demo dükkânı bir kez ekler, tekrar çalıştırınca dokunmaz", async () => {
    expect((await seedDemoShop(db)).created).toBe(false);
    expect(shop.name).toBe("Berber Demo");
    expect(shop.services).toHaveLength(6);
    expect(shop.staff.map((s) => s.name)).toEqual(["Murat", "Emre"]);
    expect(shop.hours.map((h) => h.weekday)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shop.lunch).toEqual({ start: "13:00", end: "13:45" });
    expect(shop.today).toBe("2026-11-19");
    expect(shop.lastBookableDay).toBe("2026-12-02");
  });
});

describe("GET /api/shops/[slug]", () => {
  it("olmayan dükkân için 404", async () => {
    const r = await shopInfo(db, "yok-boyle-bir-yer", NOW);
    expect(r.status).toBe(404);
  });
});

describe("GET /api/shops/[slug]/slots", () => {
  it("geçersiz parametrelerde 400 ve Türkçe açıklama", async () => {
    const r = await daySlots(db, SLUG, new URLSearchParams({ service: haircut().id, date: "20.11.2026" }), NOW);
    expect(r.status).toBe(400);
    expect((r.body as { error: { message: string } }).error.message).toContain("YYYY-AA-GG");
  });

  it("dolan saati müsait göstermez", async () => {
    const q = new URLSearchParams({ service: haircut().id, date: "2026-11-20", staff: shop.staff[0].id });
    await book(db, SLUG, body({ staffId: shop.staff[0].id }), NOW);
    const r = await daySlots(db, SLUG, q, NOW);
    const slots = (r.body as { slots: { time: string; available: boolean }[] }).slots;
    expect(slots.find((s) => s.time === "10:00")?.available).toBe(false);
    expect(slots.find((s) => s.time === "11:00")?.available).toBe(true);
    // Öğle arası hiç listelenmez.
    expect(slots.some((s) => s.time === "13:15")).toBe(false);
  });
});

describe("POST /api/shops/[slug]/appointments", () => {
  it("randevu alır ve WhatsApp mesajının önizlemesini döner", async () => {
    const r = await book(db, SLUG, body(), NOW);
    expect(r.status).toBe(201);
    const res = r.body as { appointment: Record<string, unknown>; whatsappPreview: string };
    expect(res.appointment).toMatchObject({
      date: "2026-11-20",
      time: "10:00",
      endTime: "10:30",
      serviceName: "Saç kesimi",
      staffName: "Murat",
      priceKurus: 50_000,
    });
    expect(res.whatsappPreview).toContain("20 Kasım Cuma, saat 10:00");
  });

  it("eksik veya bozuk gövdeye 400", async () => {
    expect((await book(db, SLUG, {}, NOW)).status).toBe(400);
    expect((await book(db, SLUG, body({ phone: "123" }), NOW)).status).toBe(400);
  });

  it("dolu saate 409, engelli kişiye 403", async () => {
    await book(db, SLUG, body(), NOW);
    await book(db, SLUG, body({ phone: "05331112233", name: "Mehmet Kaya" }), NOW);
    const full = await book(db, SLUG, body({ phone: "05351112233", name: "Can Aksoy" }), NOW);
    expect(full.status).toBe(409);
    expect(errorCode(full)).toBe("SLOT_TAKEN");

    await db.insert(blocks).values({ shopId: shop.id, phone: "5361112233" });
    const blocked = await book(db, SLUG, body({ time: "11:00", phone: "05361112233" }), NOW);
    expect(blocked.status).toBe(403);
  });
});

describe("Randevularım ve iptal", () => {
  it("telefonla listeler, yanlış telefonla iptal edilemez, doğru telefonla iptal edilir", async () => {
    const made = (await book(db, SLUG, body(), NOW)).body as { appointment: { id: string } };
    const id = made.appointment.id;

    const list = await lookup(db, SLUG, { phone: "5321234567" }, NOW);
    expect(list.status).toBe(200);
    expect((list.body as { appointments: { id: string }[] }).appointments.map((a) => a.id)).toEqual([id]);

    const wrong = await cancel(db, SLUG, id, { phone: "05331112233" }, NOW);
    expect(wrong.status).toBe(404);

    const right = await cancel(db, SLUG, id, { phone: "05321234567" }, NOW);
    expect(right.status).toBe(200);
    expect((right.body as { whatsappPreview: string }).whatsappPreview).toContain("iptal edildi");

    const after = await lookup(db, SLUG, { phone: "05321234567" }, NOW);
    expect((after.body as { appointments: unknown[] }).appointments).toEqual([]);
  });

  it("bozuk randevu kimliğine 404", async () => {
    const r = await cancel(db, SLUG, "abc", { phone: "05321234567" }, NOW);
    expect(r.status).toBe(404);
  });
});
