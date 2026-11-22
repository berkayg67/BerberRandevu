import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createShop } from "@/server/admin/service";
import {
  authenticate,
  createOwner,
  createSession,
  getSessionUser,
  listOwners,
  resetOwnerPassword,
  setOwnerActive,
} from "@/server/auth/service";
import { cancelAppointment, createAppointment } from "@/server/booking/service";
import { messages } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { getPanelShop, listDayAppointments, setNoShow } from "@/server/panel/service";
import { createTestDb } from "./test-db";

// Perşembe 19 Kasım 2026, 15:00 İstanbul
const NOW = new Date("2026-11-19T12:00:00Z");
const TZ = "Europe/Istanbul";

let db: Db;
let close: () => Promise<void>;
let shopA: Awaited<ReturnType<typeof createShop>>;
let shopB: Awaited<ReturnType<typeof createShop>>;

const shopInput = (name: string) => ({
  name,
  district: "Üsküdar",
  address: "Adres 1",
  phone: "0532 000 00 00",
  notifyPhone: "0532 000 00 00",
  ownerName: "Murat Usta",
  ownerPhone: null,
  monthlyFeeKurus: 0,
  billingStart: "2026-11-01",
  adminNotes: null,
});

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  close = () => t.client.close();
  shopA = await createShop(db, shopInput("Dükkân A"));
  shopB = await createShop(db, shopInput("Dükkân B"));
});
afterAll(async () => {
  await close?.();
});

async function book(shopId: string, time: string, date = "2026-11-20", phone = "05321234567") {
  const shop = await getPanelShop(db, shopId, NOW);
  return createAppointment(
    db,
    {
      shopId,
      serviceId: shop.services[0].id,
      staffId: "any",
      date,
      time,
      customerName: "Ahmet Yılmaz",
      customerPhone: phone,
      source: "panel",
    },
    NOW,
  );
}

describe("berber hesapları", () => {
  it("hesap açar, giriş yapar; dükkân kimliği oturumdan gelir", async () => {
    const { email, password } = await createOwner(db, { shopId: shopA.id, email: "Murat@Ornek.com", name: "Murat" });
    expect(email).toBe("murat@ornek.com");
    const user = await authenticate(db, email, password);
    expect(user).toMatchObject({ role: "owner", shopId: shopA.id });
    const { token } = await createSession(db, user!.id, NOW);
    expect((await getSessionUser(db, token, NOW))?.shopId).toBe(shopA.id);
  });

  it("aynı e-postayla ikinci hesap açılamaz", async () => {
    await createOwner(db, { shopId: shopA.id, email: "a@b.co", name: "Ali" });
    await expect(createOwner(db, { shopId: shopB.id, email: "A@B.co", name: "Berk" })).rejects.toThrow("zaten");
  });

  it("şifre yenilenince eski şifre ve oturumlar geçersiz olur; kapatılan hesap giremez", async () => {
    const first = await createOwner(db, { shopId: shopA.id, email: "a@b.co", name: "Ali" });
    const user = await authenticate(db, first.email, first.password);
    const { token } = await createSession(db, user!.id, NOW);

    const second = await resetOwnerPassword(db, { shopId: shopA.id, userId: user!.id });
    expect(await authenticate(db, first.email, first.password)).toBeNull();
    expect(await getSessionUser(db, token, NOW)).toBeNull();
    expect(await authenticate(db, second.email, second.password)).not.toBeNull();

    await setOwnerActive(db, { shopId: shopA.id, userId: user!.id, active: false });
    expect(await authenticate(db, second.email, second.password)).toBeNull();
    expect((await listOwners(db, shopA.id))[0].active).toBe(false);
  });

  it("başka dükkânın hesabının şifresi yenilenemez", async () => {
    const a = await createOwner(db, { shopId: shopA.id, email: "a@b.co", name: "Ali" });
    const user = await authenticate(db, a.email, a.password);
    await expect(resetOwnerPassword(db, { shopId: shopB.id, userId: user!.id })).rejects.toThrow("bulunamadı");
  });
});

describe("takvim", () => {
  it("günün randevularını saat sırasıyla, iptaller dahil listeler; diğer dükkânı göstermez", async () => {
    await book(shopA.id, "11:00");
    const early = await book(shopA.id, "09:30", "2026-11-20", "05331112233");
    const cancelled = await book(shopA.id, "14:00", "2026-11-20", "05351112233");
    await cancelAppointment(db, { shopId: shopA.id, appointmentId: cancelled.appointment.id, by: "shop" }, NOW);
    await book(shopB.id, "10:00");
    await book(shopA.id, "10:00", "2026-11-21");

    const day = await listDayAppointments(db, shopA.id, "2026-11-20", TZ, NOW);
    expect(day.appointments.map((a) => a.time)).toEqual(["09:30", "11:00", "14:00"]);
    expect(day.appointments[0].id).toBe(early.appointment.id);
    expect(day.appointments[0]).toMatchObject({ customerName: "Ahmet Yılmaz", source: "panel", past: false });
    expect(day.summary).toEqual({ count: 2, expectedKurus: 100_000, cancelled: 1, noShow: 0 });
  });

  it("gelmedi işareti: saat gelmeden olmaz; işaretlenince teşekkür mesajı durur, geri alınınca döner", async () => {
    const { appointment } = await book(shopA.id, "10:00");
    await expect(setNoShow(db, { shopId: shopA.id, appointmentId: appointment.id, noShow: true }, NOW)).rejects.toThrow(
      "gelmeden",
    );
    const during = new Date("2026-11-20T07:10:00Z"); // 10:10
    await expect(
      setNoShow(db, { shopId: shopB.id, appointmentId: appointment.id, noShow: true }, during),
    ).rejects.toThrow("bulunamadı");

    await setNoShow(db, { shopId: shopA.id, appointmentId: appointment.id, noShow: true }, during);
    const thanks = async () =>
      (await db.select().from(messages).where(eq(messages.appointmentId, appointment.id))).find((m) => m.kind === "thanks")
        ?.status;
    expect(await thanks()).toBe("cancelled");
    let day = await listDayAppointments(db, shopA.id, "2026-11-20", TZ, during);
    expect(day.summary).toMatchObject({ noShow: 1, expectedKurus: 0 });

    await setNoShow(db, { shopId: shopA.id, appointmentId: appointment.id, noShow: false }, during);
    expect(await thanks()).toBe("scheduled");
    day = await listDayAppointments(db, shopA.id, "2026-11-20", TZ, during);
    expect(day.summary.noShow).toBe(0);
  });
});
