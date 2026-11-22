import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BookingError } from "@/server/booking/errors";
import { cancelAppointment, createAppointment, getDaySlots, rescheduleAppointment } from "@/server/booking/service";
import { appointments, messages, shopPhotos, staff } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { updateCustomer } from "@/server/panel/customers";
import { addClosure, listClosures, removeClosure } from "@/server/panel/closures";
import { addPhoto, getPublicPhoto, listPhotos, listPortraits, setLogo, setStaffPhoto } from "@/server/panel/photos";
import { getReport } from "@/server/panel/reports";
import { listDayAppointments, setAppointmentNote } from "@/server/panel/service";
import { changeSlug } from "@/server/panel/settings";
import { listContentReports, resolveContentReport, submitContentReport } from "@/server/reports/content";
import { findRedirectSlug, getPublicShop } from "@/server/shops/service";
import { createTestDb, seedShop } from "./test-db";

// Perşembe 19 Kasım 2026, 15:00 İstanbul.
const NOW = new Date("2026-11-19T12:00:00Z");
const FRIDAY = "2026-11-20";
const SATURDAY = "2026-11-21";
const SUNDAY = "2026-11-22";

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

const book = (o: Partial<Parameters<typeof createAppointment>[1]> = {}) =>
  createAppointment(
    db,
    {
      shopId: ctx.shop.id,
      serviceId: ctx.haircut.id,
      staffId: ctx.murat.id,
      date: FRIDAY,
      time: "10:00",
      customerName: "Ahmet Yılmaz",
      customerPhone: "0532 123 45 67",
      source: "online",
      consent: true,
      ...o,
    },
    NOW,
  );

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
const img = { data: JPEG, width: 800, height: 600 };

describe("tatil ve izin günleri", () => {
  it("kapalı günde online randevu verilmez, berber yine de ekleyebilir", async () => {
    await addClosure(db, { shopId: ctx.shop.id, from: FRIDAY, to: SATURDAY, note: "Bayram" }, NOW);
    const online = await getDaySlots(db, { shopId: ctx.shop.id, serviceId: ctx.haircut.id, date: FRIDAY, source: "online" }, NOW);
    expect(online).toEqual([]);
    const panel = await getDaySlots(db, { shopId: ctx.shop.id, serviceId: ctx.haircut.id, date: FRIDAY, source: "panel" }, NOW);
    expect(panel.length).toBeGreaterThan(0);
    await expect(book()).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    // Aralığın dışındaki gün etkilenmez (Pazar zaten kapalı; Perşembe geçmiş değil, bugün).
    const thursday = await getDaySlots(db, { shopId: ctx.shop.id, serviceId: ctx.haircut.id, date: "2026-11-19", source: "online" }, NOW);
    expect(thursday.length).toBeGreaterThan(0);
  });

  it("müşteri sayfası kapalı günleri bildirir; kapatma kaldırılınca gün açılır", async () => {
    await addClosure(db, { shopId: ctx.shop.id, from: FRIDAY, to: FRIDAY }, NOW);
    expect((await getPublicShop(db, ctx.shop.slug, NOW)).closedDates).toEqual([FRIDAY]);
    const [c] = await listClosures(db, ctx.shop.id, NOW);
    await removeClosure(db, ctx.shop.id, c.id);
    expect((await getPublicShop(db, ctx.shop.slug, NOW)).closedDates).toEqual([]);
  });

  it("mevcut randevular için sayı döner; istenirse iptal edilip müşteriye haber verilir", async () => {
    const { appointment } = await book();
    const keep = await addClosure(db, { shopId: ctx.shop.id, from: FRIDAY, to: FRIDAY }, NOW);
    expect(keep).toEqual({ affected: 1, cancelled: 0 });
    const [still] = await db.select().from(appointments).where(eq(appointments.id, appointment.id));
    expect(still.status).toBe("active");

    const cancel = await addClosure(db, { shopId: ctx.shop.id, from: FRIDAY, to: FRIDAY, cancelExisting: true }, NOW);
    expect(cancel).toEqual({ affected: 1, cancelled: 1 });
    const [gone] = await db.select().from(appointments).where(eq(appointments.id, appointment.id));
    expect(gone.status).toBe("cancelled");
    const msgs = await db.select().from(messages).where(eq(messages.appointmentId, appointment.id));
    expect(msgs.some((m) => m.kind === "cancel_customer")).toBe(true);
  });

  it("geçersiz aralıkları reddeder", async () => {
    await expect(addClosure(db, { shopId: ctx.shop.id, from: "2026-11-10", to: "2026-11-12" }, NOW)).rejects.toThrow(/Geçmiş/);
    await expect(addClosure(db, { shopId: ctx.shop.id, from: SATURDAY, to: FRIDAY }, NOW)).rejects.toThrow(/başlangıçtan önce/);
    await expect(addClosure(db, { shopId: ctx.shop.id, from: FRIDAY, to: "2027-06-01" }, NOW)).rejects.toThrow(/art arda/);
    await expect(addClosure(db, { shopId: ctx.shop.id, from: "bozuk", to: "bozuk" }, NOW)).rejects.toBeInstanceOf(BookingError);
  });
});

describe("randevu taşıma", () => {
  it("başka saate taşır; eski mesajlar iptal olur, yenileri yazılır", async () => {
    const { appointment } = await book({ time: "10:00" });
    const moved = await rescheduleAppointment(
      db,
      { shopId: ctx.shop.id, appointmentId: appointment.id, date: SATURDAY, time: "11:30" },
      NOW,
    );
    expect(moved.appointment.startsAt.toISOString()).toBe("2026-11-21T08:30:00.000Z");
    expect(moved.appointment.endsAt.getTime() - moved.appointment.startsAt.getTime()).toBe(30 * 60_000);

    const all = await db.select().from(messages).where(eq(messages.appointmentId, appointment.id));
    const scheduledOld = all.filter((m) => m.status === "cancelled");
    expect(scheduledOld.length).toBeGreaterThanOrEqual(3); // onay, hatırlatma, teşekkür
    const fresh = all.filter((m) => m.status === "scheduled");
    expect(fresh.map((m) => m.kind).sort()).toEqual(["confirm", "new_booking", "reminder", "thanks"]);
    expect(fresh.find((m) => m.kind === "confirm")!.body).toContain("randevunuz güncellendi");
    expect(fresh.find((m) => m.kind === "confirm")!.body).toContain("11:30");
  });

  it("kendi eski saatinin üstüne ve boş olmayan saate taşıma kuralı", async () => {
    const a = await book({ time: "10:00" });
    // Kendi saatine yakın bir saate (10:15) taşınabilir: kendisi dolu sayılmaz.
    await rescheduleAppointment(db, { shopId: ctx.shop.id, appointmentId: a.appointment.id, date: FRIDAY, time: "10:15" }, NOW);
    // Aynı ustanın dolu olduğu saate ikinci randevu taşınamaz.
    const b = await book({ time: "12:00", customerPhone: "0533 111 22 33", customerName: "Veli Kaya" });
    await expect(
      rescheduleAppointment(db, { shopId: ctx.shop.id, appointmentId: b.appointment.id, date: FRIDAY, time: "10:30" }, NOW),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    // Başka ustaya taşınabilir.
    const ok = await rescheduleAppointment(
      db,
      { shopId: ctx.shop.id, appointmentId: b.appointment.id, date: FRIDAY, time: "10:30", staffId: ctx.emre.id },
      NOW,
    );
    expect(ok.staffName).toBe("Emre");
  });

  it("hizmet değiştirince süre ve fiyat yeni hizmete göre olur", async () => {
    const { appointment } = await book();
    const beard = (await db.query.services.findMany()).find((s) => s.name === "Sakal tıraşı")!;
    const r = await rescheduleAppointment(
      db,
      { shopId: ctx.shop.id, appointmentId: appointment.id, date: FRIDAY, time: "10:00", serviceId: beard.id },
      NOW,
    );
    expect(r.appointment.serviceName).toBe("Sakal tıraşı");
    expect(r.appointment.priceKurus).toBe(25000);
    expect(r.appointment.endsAt.getTime() - r.appointment.startsAt.getTime()).toBe(20 * 60_000);
  });

  it("iptal edilmiş, geçmiş ya da başka dükkâna ait randevu taşınamaz; öğle arası ve Pazar reddedilir", async () => {
    const a = await book();
    await expect(
      rescheduleAppointment(db, { shopId: ctx.shop.id, appointmentId: a.appointment.id, date: FRIDAY, time: "13:00" }, NOW),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(
      rescheduleAppointment(db, { shopId: ctx.shop.id, appointmentId: a.appointment.id, date: SUNDAY, time: "10:00" }, NOW),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(
      rescheduleAppointment(db, { shopId: crypto.randomUUID(), appointmentId: a.appointment.id, date: FRIDAY, time: "11:00" }, NOW),
    ).rejects.toBeInstanceOf(BookingError);
    await cancelAppointment(db, { shopId: ctx.shop.id, appointmentId: a.appointment.id, by: "shop" }, NOW);
    await expect(
      rescheduleAppointment(db, { shopId: ctx.shop.id, appointmentId: a.appointment.id, date: FRIDAY, time: "11:00" }, NOW),
    ).rejects.toMatchObject({ code: "ALREADY_CANCELLED" });
    const later = new Date("2026-11-21T10:00:00Z");
    const b = await book({ time: "12:00", customerPhone: "0533 111 22 33", customerName: "Veli Kaya" });
    await expect(
      rescheduleAppointment(db, { shopId: ctx.shop.id, appointmentId: b.appointment.id, date: SATURDAY, time: "12:00" }, later),
    ).rejects.toMatchObject({ code: "TOO_LATE" });
  });

  it("rıza vermeyen müşteri için taşıyınca teşekkür mesajı eklenmez", async () => {
    const { appointment } = await book({ consent: false });
    await rescheduleAppointment(db, { shopId: ctx.shop.id, appointmentId: appointment.id, date: SATURDAY, time: "11:00" }, NOW);
    const all = await db.select().from(messages).where(eq(messages.appointmentId, appointment.id));
    expect(all.some((m) => m.kind === "thanks")).toBe(false);
  });
});

describe("notlar ve müşteri düzenleme", () => {
  it("randevu notu kaydedilir ve gün listesinde görünür; boş not siler", async () => {
    const { appointment } = await book();
    await setAppointmentNote(db, { shopId: ctx.shop.id, appointmentId: appointment.id, note: "  Sakalı kısa ister " });
    const day = await listDayAppointments(db, ctx.shop.id, FRIDAY, "Europe/Istanbul", NOW);
    expect(day.appointments[0].note).toBe("Sakalı kısa ister");
    await setAppointmentNote(db, { shopId: ctx.shop.id, appointmentId: appointment.id, note: "" });
    expect((await listDayAppointments(db, ctx.shop.id, FRIDAY, "Europe/Istanbul", NOW)).appointments[0].note).toBeNull();
    await expect(
      setAppointmentNote(db, { shopId: crypto.randomUUID(), appointmentId: appointment.id, note: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("müşteri adı, telefonu ve notu güncellenir; çakışan telefon reddedilir", async () => {
    const a = await book();
    const b = await book({ time: "12:00", customerPhone: "0533 111 22 33", customerName: "Veli Kaya" });
    await updateCustomer(db, { shopId: ctx.shop.id, customerId: a.customer.id, name: "Ahmet  Y.", phone: "0532 999 88 77", note: "Çay içer" });
    const day = await listDayAppointments(db, ctx.shop.id, FRIDAY, "Europe/Istanbul", NOW);
    expect(day.appointments[0]).toMatchObject({ customerName: "Ahmet Y.", customerPhone: "5329998877", customerNote: "Çay içer" });
    await expect(
      updateCustomer(db, { shopId: ctx.shop.id, customerId: b.customer.id, name: "Veli", phone: "0532 999 88 77", note: "" }),
    ).rejects.toThrow(/başka bir müşteride/);
    await expect(
      updateCustomer(db, { shopId: ctx.shop.id, customerId: b.customer.id, name: "Veli", phone: "123", note: "" }),
    ).rejects.toMatchObject({ code: "INVALID_PHONE" });
  });
});

describe("dükkân adresi", () => {
  it("adres değişir, eski adres yeni adrese yönlenir, geri dönülebilir", async () => {
    expect(await changeSlug(db, ctx.shop.id, "Erhan Kaya")).toEqual({ slug: "erhan-kaya", changed: true });
    expect(await findRedirectSlug(db, "test-berber")).toBe("erhan-kaya");
    expect((await getPublicShop(db, "erhan-kaya", NOW)).name).toBe("Test Berber");
    expect(await changeSlug(db, ctx.shop.id, "erhan-kaya")).toEqual({ slug: "erhan-kaya", changed: false });
    expect(await changeSlug(db, ctx.shop.id, "test-berber")).toEqual({ slug: "test-berber", changed: true });
    expect(await findRedirectSlug(db, "test-berber")).toBeNull();
    expect(await findRedirectSlug(db, "erhan-kaya")).toBe("test-berber");
  });

  it("sistem adresleri, kısa adresler ve başkasının adresleri alınamaz", async () => {
    await expect(changeSlug(db, ctx.shop.id, "admin")).rejects.toThrow(/sistem/);
    await expect(changeSlug(db, ctx.shop.id, "ab")).rejects.toThrow(/en az 3/);
    await expect(changeSlug(db, ctx.shop.id, "!!!")).rejects.toThrow(/en az 3/);
    const { createShop } = await import("@/server/admin/service");
    const other = await createShop(db, {
      name: "Başka Berber",
      district: "Üsküdar",
      address: "Adres mah. no 1",
      phone: "0532 111 11 11",
      notifyPhone: "0532 111 11 11",
      ownerName: "Ali",
      ownerPhone: "0532 111 11 11",
      monthlyFeeKurus: 0,
      billingStart: "2026-11-01",
      adminNotes: null,
    });
    await expect(changeSlug(db, ctx.shop.id, other.slug)).rejects.toThrow(/başka bir dükkânda/);
    // Başkasının eski adresi de alınamaz.
    await changeSlug(db, other.id, "yeni-adres");
    await expect(changeSlug(db, ctx.shop.id, other.slug)).rejects.toThrow(/başka bir dükkânda/);
  });
});

describe("logo ve usta fotoğrafı", () => {
  it("logo tek olur, yeniden yükleyince değişir; galeri sayısına girmez", async () => {
    const first = await setLogo(db, ctx.shop.id, img);
    const second = await setLogo(db, ctx.shop.id, img);
    expect(second.id).not.toBe(first.id);
    expect((await listPortraits(db, ctx.shop.id)).logoId).toBe(second.id);
    expect(await listPhotos(db, ctx.shop.id)).toEqual([]);
    await addPhoto(db, ctx.shop.id, img);
    expect(await listPhotos(db, ctx.shop.id)).toHaveLength(1);
    const pub = await getPublicShop(db, ctx.shop.slug, NOW);
    expect(pub.logoId).toBe(second.id);
    expect(pub.photos).toHaveLength(1);
  });

  it("usta fotoğrafı ustaya bağlanır; başka dükkânın ustasına yüklenemez", async () => {
    const p = await setStaffPhoto(db, ctx.shop.id, ctx.murat.id, img);
    const pub = await getPublicShop(db, ctx.shop.slug, NOW);
    expect(pub.staff.find((s) => s.id === ctx.murat.id)!.photoId).toBe(p.id);
    expect(pub.staff.find((s) => s.id === ctx.emre.id)!.photoId).toBeNull();
    await expect(setStaffPhoto(db, ctx.shop.id, crypto.randomUUID(), img)).rejects.toThrow(/Usta bulunamadı/);
    expect(await getPublicPhoto(db, p.id)).toBeNull(); // dükkân onaylı değil (seed'de approvedAt yok)
  });

  it("ustayı silince fotoğrafı da silinir", async () => {
    await setStaffPhoto(db, ctx.shop.id, ctx.emre.id, img);
    await db.delete(staff).where(eq(staff.id, ctx.emre.id));
    const left = await db.select().from(shopPhotos).where(eq(shopPhotos.staffId, ctx.emre.id));
    expect(left).toHaveLength(0);
  });
});

describe("rapor", () => {
  it("gelir yalnızca gerçekleşen randevulardan; iptal ve gelmedi ayrı sayılır", async () => {
    const later = new Date("2026-11-21T20:00:00Z");
    const a = await book({ time: "10:00" }); // 500 ₺
    const b = await book({ time: "12:00", customerPhone: "0533 111 22 33", customerName: "Veli Kaya", staffId: ctx.emre.id });
    const c = await book({ time: "14:30", customerPhone: "0534 111 22 33", customerName: "Can Er" });
    await cancelAppointment(db, { shopId: ctx.shop.id, appointmentId: c.appointment.id, by: "customer", customerPhone: "0534 111 22 33" }, NOW);
    await db.update(appointments).set({ noShow: true }).where(eq(appointments.id, b.appointment.id));
    void a;
    const r = await getReport(db, ctx.shop.id, "7", later);
    expect(r.totals).toMatchObject({ booked: 3, done: 1, cancelled: 1, noShow: 1, revenueKurus: 50000, averageKurus: 50000, cancelRate: 33, noShowRate: 33 });
    expect(r.byService).toEqual([{ name: "Saç kesimi", count: 1, revenueKurus: 50000 }]);
    expect(r.byStaff[0].name).toBe("Murat");
    expect(r.byWeekday[5]).toBe(1); // Cuma
    expect(r.byHour).toEqual([{ hour: 10, count: 1 }]);
    expect(r.topCustomers).toEqual([{ name: "Ahmet Yılmaz", visits: 1, spentKurus: 50000 }]);
    // Henüz bitmemiş randevu gelir sayılmaz.
    const early = await getReport(db, ctx.shop.id, "7", new Date("2026-11-20T06:00:00Z"));
    expect(early.totals.revenueKurus).toBe(0);
    expect(early.totals.upcoming).toBe(1);
  });

  it("randevu yokken boş ve sıfır döner", async () => {
    const r = await getReport(db, ctx.shop.id, "30", NOW);
    expect(r.totals).toMatchObject({ booked: 0, revenueKurus: 0, cancelRate: 0, averageKurus: 0 });
    expect(r.byService).toEqual([]);
  });
});

describe("içerik bildirimi", () => {
  it("bildirim kaydedilir, tekrarı birleştirilir, yönetici sonuçlandırır ve fotoğrafları kaldırabilir", async () => {
    await addPhoto(db, ctx.shop.id, img);
    const input = { shopSlug: ctx.shop.slug, target: "/test-berber galeri", reason: "hak_ihlali", details: "Bu fotoğraf bana ait, izinsiz kullanılmış.", contact: "a@b.co" };
    const first = await submitContentReport(db, input);
    const dupe = await submitContentReport(db, input);
    expect(dupe.id).toBe(first.id);
    const open = await listContentReports(db, { open: true });
    expect(open).toHaveLength(1);
    expect(open[0].shopName).toBe("Test Berber");

    await resolveContentReport(db, { id: first.id, resolution: "Fotoğraflar kaldırıldı", removeGallery: true });
    expect(await listContentReports(db, { open: true })).toHaveLength(0);
    expect(await listPhotos(db, ctx.shop.id)).toEqual([]);
  });

  it("eksik ya da geçersiz bildirimleri reddeder", async () => {
    await expect(submitContentReport(db, { target: "x", reason: "diger", details: "yeterince uzun bir açıklama" })).rejects.toThrow(/sayfayı/);
    await expect(submitContentReport(db, { target: "/sayfa", reason: "yok", details: "yeterince uzun bir açıklama" })).rejects.toThrow(/nedenini/);
    await expect(submitContentReport(db, { target: "/sayfa", reason: "diger", details: "kısa" })).rejects.toThrow(/açıklayın/);
  });
});
