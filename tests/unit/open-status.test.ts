import { describe, expect, it } from "vitest";
import { openStatus } from "@/lib/domain/open-status";

const hours = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "09:00", closes: "21:00" }));
const lunch = { start: "13:00", end: "13:45" };
const TZ = "Europe/Istanbul";
// 20 Kasım 2026 Cuma; İstanbul = UTC+3
const at = (iso: string) => new Date(iso);

describe("openStatus", () => {
  it("açık, öğle arası, açılmadan önce", () => {
    expect(openStatus(hours, lunch, TZ, at("2026-11-20T07:00:00Z")).text).toBe("Şu an açık, 21:00'e kadar");
    expect(openStatus(hours, lunch, TZ, at("2026-11-20T10:10:00Z"))).toEqual({ open: false, text: "Öğle arası, 13:45'te açılıyor" });
    expect(openStatus(hours, lunch, TZ, at("2026-11-20T05:00:00Z")).text).toBe("Bugün 09:00'da açılıyor");
  });

  it("kapanıştan sonra ve kapalı günde sonraki açılışı söyler", () => {
    expect(openStatus(hours, lunch, TZ, at("2026-11-20T19:00:00Z")).text).toBe("Şu an kapalı, yarın 09:00'da açılıyor");
    // Cumartesi akşamı → Pazar kapalı → Pazartesi
    expect(openStatus(hours, lunch, TZ, at("2026-11-21T19:00:00Z")).text).toBe("Şu an kapalı, Pazartesi 09:00'da açılıyor");
    expect(openStatus([], null, TZ, at("2026-11-21T19:00:00Z")).text).toBe("Şu an randevu alınmıyor");
  });
});
