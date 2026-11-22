import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createShop } from "@/server/admin/service";
import { BookingError } from "@/server/booking/errors";
import { createAppointment } from "@/server/booking/service";
import { appointments } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { blockCustomer, getCustomer, listBlocks, listCustomers, unblock } from "@/server/panel/customers";
import { getPanelShop, setNoShow } from "@/server/panel/service";
import { createTestDb } from "./test-db";

const NOW = new Date("2026-11-19T12:00:00Z"); // Perşembe 15:00
const LATER = new Date("2026-11-20T15:00:00Z"); // Cuma 18:00

let db: Db;
let close: () => Promise<void>;
let shopId: string;
let otherShopId: string;

const shopInput = (name: string) => ({
  name,
  district: "Üsküdar",
  address: "Adres 1",
  phone: "0532 000 00 00",
  notifyPhone: "0532 000 00 00",
  ownerName: "Murat",
  ownerPhone: null,
  monthlyFeeKurus: 0,
  billingStart: "2026-11-01",
  adminNotes: null,
});

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  close = () => t.client.close();
  shopId = (await createShop(db, shopInput("Dükkân A"))).id;
  otherShopId = (await createShop(db, shopInput("Dükkân B"))).id;
});
afterAll(async () => {
  await close?.();
});

async function book(sid: string, date: string, time: string, name: string, phone: string) {
  const shop = await getPanelShop(db, sid, NOW);
  return createAppointment(
    db,
    { shopId: sid, serviceId: shop.services[0].id, staffId: "any", date, time, customerName: name, customerPhone: phone, source: "online", consent: true },
    NOW,
  );
}

describe("müşteri listesi", () => {
  it("geldiği, gelmediği ve yaklaşan randevularını sayar; aramayla süzer; diğer dükkânı göstermez", async () => {
    const a1 = await book(shopId, "2026-11-20", "09:00", "Ahmet Yılmaz", "05321234567");
    const a2 = await book(shopId, "2026-11-20", "11:00", "Ahmet Yılmaz", "05321234567");
    await book(shopId, "2026-11-21", "10:00", "Ahmet Yılmaz", "05321234567");
    await book(shopId, "2026-11-20", "10:00", "Mehmet Kaya", "05331112233");
    await book(otherShopId, "2026-11-20", "10:00", "Başka Dükkân Müşterisi", "05441112233");
    await setNoShow(db, { shopId, appointmentId: a2.appointment.id, noShow: true }, LATER);

    const list = await listCustomers(db, shopId, "", LATER);
    expect(list.map((c) => c.name).sort()).toEqual(["Ahmet Yılmaz", "Mehmet Kaya"]);
    const ahmet = list.find((c) => c.name === "Ahmet Yılmaz")!;
    expect(ahmet).toMatchObject({ visits: 1, noShows: 1, upcoming: 1, blocked: false });
    // Son gelişi 09:00 randevusudur; 11:00'e gelmediği için o sayılmaz.
    expect(ahmet.lastAt?.toISOString()).toBe(a1.appointment.startsAt.toISOString());
    expect((await listCustomers(db, shopId, "mehmet", LATER)).map((c) => c.name)).toEqual(["Mehmet Kaya"]);
    expect((await listCustomers(db, shopId, "0533 111", LATER)).map((c) => c.name)).toEqual(["Mehmet Kaya"]);
  });

  it("ayrıntı: harcama ve geçmiş; başka dükkânın müşterisi görünmez", async () => {
    const a = await book(shopId, "2026-11-20", "09:00", "Ahmet Yılmaz", "05321234567");
    const detail = await getCustomer(db, shopId, a.customer.id, LATER);
    expect(detail?.stats).toEqual({ visits: 1, noShows: 0, spentKurus: 50_000, upcoming: 0 });
    expect(detail?.history).toHaveLength(1);
    expect(await getCustomer(db, otherShopId, a.customer.id, LATER)).toBeNull();
  });
});

describe("engelleme", () => {
  it("engellenince yaklaşan randevular iptal olur ve online randevu alamaz; engel kalkınca alabilir", async () => {
    const a = await book(shopId, "2026-11-21", "10:00", "Ahmet Yılmaz", "05321234567");
    const { block, cancelled } = await blockCustomer(db, { shopId, phone: "0532 123 45 67", note: "3 kez gelmedi" }, NOW);
    expect(cancelled).toBe(1);
    const [row] = await db.select().from(appointments).where(eq(appointments.id, a.appointment.id));
    expect(row).toMatchObject({ status: "cancelled", cancelledBy: "shop" });

    await expect(book(shopId, "2026-11-21", "11:00", "Başka İsim", "05321234567")).rejects.toBeInstanceOf(BookingError);
    expect((await listCustomers(db, shopId, "", NOW))[0].blocked).toBe(true);
    expect((await getCustomer(db, shopId, a.customer.id, NOW))?.block?.note).toBe("3 kez gelmedi");

    // Engel yalnızca o dükkân için geçerli.
    await book(otherShopId, "2026-11-21", "11:00", "Ahmet Yılmaz", "05321234567");

    await unblock(db, shopId, block.id);
    expect(await listBlocks(db, shopId)).toEqual([]);
    await book(shopId, "2026-11-21", "11:00", "Ahmet Yılmaz", "05321234567");
  });

  it("boş ya da geçersiz bilgiyle engellenemez; başka dükkânın engeli kaldırılamaz", async () => {
    await expect(blockCustomer(db, { shopId }, NOW)).rejects.toThrow("İsim ya da telefon");
    await expect(blockCustomer(db, { shopId, phone: "123" }, NOW)).rejects.toThrow("geçersiz");
    const { block } = await blockCustomer(db, { shopId, name: "Hasan Örnek" }, NOW);
    await unblock(db, otherShopId, block.id);
    expect(await listBlocks(db, shopId)).toHaveLength(1);
  });
});
