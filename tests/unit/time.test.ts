import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDayTr,
  formatTimeTr,
  isLocalDate,
  toHHMM,
  toMinutes,
  utcToZoned,
  weekdayOf,
  zonedToUtc,
} from "@/lib/domain/time";

const TZ = "Europe/Istanbul";

describe("saat dilimi", () => {
  it("İstanbul saatini UTC'ye çevirir (UTC+3)", () => {
    expect(zonedToUtc("2026-11-20", toMinutes("10:15"), TZ).toISOString()).toBe(
      "2026-11-20T07:15:00.000Z",
    );
  });

  it("gece yarısını doğru güne koyar", () => {
    expect(utcToZoned(new Date("2026-11-20T22:30:00Z"), TZ)).toEqual({
      date: "2026-11-21",
      minutes: 90,
    });
  });

  it("yaz saati uygulayan bir bölgede de doğru çalışır", () => {
    // Berlin 2026 yaz saati: 29 Mart 02:00'de ileri alınır.
    expect(zonedToUtc("2026-03-30", toMinutes("10:00"), "Europe/Berlin").toISOString()).toBe(
      "2026-03-30T08:00:00.000Z",
    );
    expect(zonedToUtc("2026-03-27", toMinutes("10:00"), "Europe/Berlin").toISOString()).toBe(
      "2026-03-27T09:00:00.000Z",
    );
  });

  it("Türkçe gün ve saat yazar", () => {
    const at = new Date("2026-11-20T07:15:00Z");
    expect(formatDayTr(at, TZ)).toBe("20 Kasım Cuma");
    expect(formatTimeTr(at, TZ)).toBe("10:15");
  });
});

describe("tarih yardımcıları", () => {
  it("haftanın gününü verir (0 = Pazar)", () => {
    expect(weekdayOf("2026-11-22")).toBe(0);
    expect(weekdayOf("2026-11-20")).toBe(5);
  });

  it("ay ve yıl geçişlerinde gün ekler", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("geçersiz tarihleri reddeder", () => {
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-11-20")).toBe(true);
    expect(isLocalDate("20.11.2026")).toBe(false);
  });

  it("saat ↔ dakika", () => {
    expect(toMinutes("09:30:00")).toBe(570);
    expect(toHHMM(570)).toBe("09:30");
    expect(() => toMinutes("25:00")).toThrow();
  });
});
