import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createShop } from "@/server/admin/service";
import { cancelAppointment, createAppointment, getDaySlots } from "@/server/booking/service";
import type { Db } from "@/server/db/types";
import { listMessages } from "@/server/panel/messages";
import { getSettings, saveContact, saveHours, saveRules, saveService, saveStaff } from "@/server/panel/settings";
import { createTestDb } from "./test-db";

const NOW = new Date("2026-11-19T12:00:00Z"); // Perşembe 15:00
let db: Db;
let close: () => Promise<void>;
let shopId: string;
let otherId: string;

const input = (name: string) => ({
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
  shopId = (await createShop(db, input("Dükkân A"))).id;
  otherId = (await createShop(db, input("Dükkân B"))).id;
});
afterAll(async () => {
  await close?.();
});

const slots = async (date: string, serviceId?: string) => {
  const s = await getSettings(db, shopId);
  return getDaySlots(db, { shopId, serviceId: serviceId ?? s.services[0].id, date, source: "online" }, NOW);
};

describe("çalışma saatleri", () => {
  it("günü kapatır, saatleri ve öğle arasını değiştirir; randevu saatleri buna uyar", async () => {
    const s = await getSettings(db, shopId);
    expect(s.week[0].hours).toBeNull(); // Pazar kapalı
    const week = s.week.map((d) =>
      d.weekday === 5 ? { ...d, hours: { opens: "10:00", closes: "12:00" } } : d.weekday === 6 ? { ...d, hours: null } : d,
    );
    await saveHours(db, shopId, { week, lunch: { start: "11:00", end: "11:30" } });

    const friday = (await slots("2026-11-20")).map((x) => x.time);
    expect(friday[0]).toBe("10:00");
    expect(friday).not.toContain("11:00"); // öğle arası
    expect(friday).toContain("11:30");
    expect(friday.at(-1)).toBe("11:30"); // 30 dk hizmet 12:00'de bitmeli
    expect(await slots("2026-11-21")).toEqual([]); // Cumartesi kapatıldı
  });

  it("hatalı saatleri reddeder", async () => {
    const s = await getSettings(db, shopId);
    const bad = s.week.map((d) => (d.weekday === 1 ? { ...d, hours: { opens: "18:00", closes: "09:00" } } : d));
    await expect(saveHours(db, shopId, { week: bad, lunch: null })).rejects.toThrow("Pazartesi");
    await expect(saveHours(db, shopId, { week: s.week.map((d) => ({ ...d, hours: null })), lunch: null })).rejects.toThrow(
      "En az bir gün",
    );
    await expect(saveHours(db, shopId, { week: s.week, lunch: { start: "14:00", end: "13:00" } })).rejects.toThrow("Öğle");
  });
});

describe("kurallar ve iletişim", () => {
  it("izin verilen değerleri kaydeder, diğerlerini reddeder", async () => {
    const { rules } = await getSettings(db, shopId);
    await saveRules(db, shopId, { ...rules, slotMinutes: 30, bufferMinutes: 10 });
    expect((await getSettings(db, shopId)).rules).toMatchObject({ slotMinutes: 30, bufferMinutes: 10 });
    expect((await slots("2026-11-20")).map((x) => x.time).slice(0, 3)).toEqual(["09:00", "09:30", "10:00"]);
    await expect(saveRules(db, shopId, { ...rules, slotMinutes: 7 })).rejects.toThrow("geçersiz");
  });

  it("iletişim bilgilerini doğrular", async () => {
    await saveContact(db, shopId, { phone: "0216 123 45 67", address: "Yeni adres 5", notifyPhone: "0533 111 22 33", reviewUrl: "https://g.page/r/X/review" });
    expect((await getSettings(db, shopId)).contact).toEqual({
      phone: "0216 123 45 67",
      address: "Yeni adres 5",
      notifyPhone: "5331112233",
      reviewUrl: "https://g.page/r/X/review",
    });
    await expect(saveContact(db, shopId, { phone: "0216", address: "Yeni adres 5", notifyPhone: "05331112233", reviewUrl: "" })).rejects.toThrow();
    await expect(
      saveContact(db, shopId, { phone: "0216 123 45 67", address: "Yeni adres 5", notifyPhone: "02161234567", reviewUrl: "" }),
    ).rejects.toThrow("Bildirim");
    await expect(
      saveContact(db, shopId, { phone: "0216 123 45 67", address: "Yeni adres 5", notifyPhone: "05331112233", reviewUrl: "g.page/x" }),
    ).rejects.toThrow("https");
  });
});

describe("hizmetler ve ustalar", () => {
  it("hizmet ekler, fiyatını değiştirir, kapatır; son açık hizmet kapatılamaz; başka dükkânınki değiştirilemez", async () => {
    await saveService(db, shopId, { name: "Ense tıraşı", durationMinutes: 10, priceKurus: 10_000, active: true });
    let s = await getSettings(db, shopId);
    const ense = s.services.find((x) => x.name === "Ense tıraşı")!;
    expect(ense).toMatchObject({ durationMinutes: 10, priceKurus: 10_000, active: true });
    await saveService(db, shopId, { ...ense, priceKurus: 12_000 });
    s = await getSettings(db, shopId);
    expect(s.services.find((x) => x.id === ense.id)?.priceKurus).toBe(12_000);

    for (const x of s.services.filter((x) => x.id !== ense.id)) await saveService(db, shopId, { ...x, active: false });
    await expect(saveService(db, shopId, { ...ense, active: false })).rejects.toThrow("En az bir hizmet");
    expect((await getSettings(db, shopId)).services.find((x) => x.id === ense.id)?.active).toBe(true);

    await expect(saveService(db, otherId, { ...ense, priceKurus: 1 })).rejects.toThrow("bulunamadı");
    await expect(saveService(db, shopId, { name: "X", durationMinutes: 3, priceKurus: 0, active: true })).rejects.toThrow();
    await expect(saveService(db, shopId, { name: "ense TIRAŞI", durationMinutes: 10, priceKurus: 0, active: true })).rejects.toThrow("zaten");
    // Kendi adıyla kaydetmek sorun değil.
    await saveService(db, shopId, { ...ense, name: "Ense tıraşı" });
  });

  it("usta ekler; kapatılan usta yeni randevu almaz ve yaklaşan randevu sayısı bildirilir", async () => {
    await saveStaff(db, shopId, { name: "Emre", active: true });
    const s = await getSettings(db, shopId);
    expect(s.staff.map((x) => x.name)).toEqual(["Murat", "Emre"]);
    const emre = s.staff[1];
    await createAppointment(
      db,
      { shopId, serviceId: s.services[0].id, staffId: emre.id, date: "2026-11-20", time: "10:00", customerName: "Ali Veli", customerPhone: "05321234567", source: "online" },
      NOW,
    );
    expect(await saveStaff(db, shopId, { id: emre.id, name: "Emre", active: false }, NOW)).toEqual({ upcoming: 1 });
    const free = (await slots("2026-11-20")).find((x) => x.time === "11:00")!.freeStaffIds;
    expect(free).toEqual([s.staff[0].id]);
    await expect(saveStaff(db, shopId, { id: s.staff[0].id, name: "Murat", active: false }, NOW)).rejects.toThrow("En az bir usta");
    await expect(saveStaff(db, shopId, { name: "emre", active: true }, NOW)).rejects.toThrow("zaten");
  });
});

describe("mesajlar", () => {
  it("sıradakileri en yakından, iptal edilenleri ayrı listeler; başka dükkânınkini göstermez", async () => {
    const s = await getSettings(db, shopId);
    const a = await createAppointment(
      db,
      { shopId, serviceId: s.services[0].id, staffId: "any", date: "2026-11-20", time: "10:00", customerName: "Ali Veli", customerPhone: "05321234567", source: "online" },
      NOW,
    );
    const o = await getSettings(db, otherId);
    await createAppointment(
      db,
      { shopId: otherId, serviceId: o.services[0].id, staffId: "any", date: "2026-11-20", time: "10:00", customerName: "Başka", customerPhone: "05331112233", source: "online" },
      NOW,
    );
    let r = await listMessages(db, shopId, "sirada", NOW);
    expect(r.messages.map((m) => m.kind)).toEqual(["confirm", "new_booking", "reminder", "thanks"].filter((k) => r.messages.some((m) => m.kind === k)));
    expect(r.messages).toHaveLength(4);
    expect(r.messages[0].customerName).toBe("Ali Veli");
    expect(r.hasDue).toBe(true); // onay mesajı hemen gönderilecekti

    await cancelAppointment(db, { shopId, appointmentId: a.appointment.id, by: "customer", customerPhone: "05321234567" }, NOW);
    r = await listMessages(db, shopId, "iptal", NOW);
    expect(r.messages.map((m) => m.kind).sort()).toEqual(["reminder", "thanks"]);
    expect((await listMessages(db, shopId, "hepsi", NOW)).messages).toHaveLength(6);
  });
});
