import { describe, expect, it } from "vitest";
import {
  planBookingMessages,
  planCancellationMessages,
  type AppointmentFacts,
} from "@/lib/domain/messages";

const facts: AppointmentFacts = {
  shop: {
    name: "Berber Demo",
    address: "Örnek Mah. Örnek Sk. No:1, Üsküdar / İstanbul",
    phone: "0532 000 00 00",
    notifyPhone: "5320000000",
    reviewUrl: "https://g.page/r/ORNEK/review",
    timeZone: "Europe/Istanbul",
  },
  customer: { name: "Ahmet Yılmaz", phone: "5321234567" },
  serviceName: "Saç ve sakal",
  staffName: "Murat",
  startsAt: new Date("2026-11-20T07:15:00Z"),
  endsAt: new Date("2026-11-20T08:00:00Z"),
  source: "online",
};
const timing = { reminderMinutesBefore: 60, thanksMinutesAfter: 30 };
const now = new Date("2026-11-19T12:00:00Z");

describe("planBookingMessages", () => {
  const drafts = planBookingMessages(facts, timing, now);

  it("onay, dükkân bildirimi, hatırlatma ve teşekkür planlar", () => {
    expect(drafts.map((d) => d.kind)).toEqual(["confirm", "new_booking", "reminder", "thanks"]);
  });

  it("doğru kişiye ve doğru zamanda gönderir", () => {
    const byKind = Object.fromEntries(drafts.map((d) => [d.kind, d]));
    expect(byKind.confirm.toPhone).toBe("905321234567");
    expect(byKind.new_booking.toPhone).toBe("905320000000");
    expect(byKind.confirm.sendAt).toEqual(now);
    expect(byKind.reminder.sendAt.toISOString()).toBe("2026-11-20T06:15:00.000Z");
    expect(byKind.thanks.sendAt.toISOString()).toBe("2026-11-20T08:30:00.000Z");
  });

  it("mesajlarda Türkçe gün, saat ve yorum linki geçer", () => {
    const byKind = Object.fromEntries(drafts.map((d) => [d.kind, d.body]));
    expect(byKind.confirm).toContain("Merhaba Ahmet");
    expect(byKind.confirm).toContain("20 Kasım Cuma, saat 10:15");
    expect(byKind.new_booking).toContain("0532 123 45 67");
    expect(byKind.reminder).toContain("bugün saat 10:15");
    expect(byKind.thanks).toContain("Sıhhatler olsun Ahmet");
    expect(byKind.thanks).toContain("https://g.page/r/ORNEK/review");
  });

  it("randevu çok yakınsa hatırlatma planlamaz", () => {
    const late = planBookingMessages(facts, timing, new Date("2026-11-20T06:30:00Z"));
    expect(late.map((d) => d.kind)).not.toContain("reminder");
  });

  it("yorum linki yoksa teşekkür mesajında link olmaz", () => {
    const noLink = planBookingMessages({ ...facts, shop: { ...facts.shop, reviewUrl: null } }, timing, now);
    expect(noLink.find((d) => d.kind === "thanks")?.body).not.toContain("http");
  });
});

describe("planCancellationMessages", () => {
  it("müşteriye ve dükkâna bildirir, kimin iptal ettiğini yazar", () => {
    const drafts = planCancellationMessages(facts, "customer", now);
    expect(drafts.map((d) => [d.kind, d.recipient])).toEqual([
      ["cancel_customer", "customer"],
      ["cancel_shop", "shop"],
    ]);
    expect(drafts[1].body).toContain("müşteri iptal etti");
  });
});
