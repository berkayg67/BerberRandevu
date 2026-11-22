import { describe, expect, it } from "vitest";
import { computeSlots, type AvailabilityInput } from "@/lib/domain/availability";
import { toMinutes, zonedToUtc } from "@/lib/domain/time";

const TZ = "Europe/Istanbul";
const DATE = "2026-11-20";
const at = (hhmm: string) => zonedToUtc(DATE, toMinutes(hhmm), TZ);

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: DATE,
    timeZone: TZ,
    hours: { opens: toMinutes("09:00"), closes: toMinutes("12:00") },
    lunch: null,
    slotMinutes: 15,
    bufferMinutes: 0,
    minNoticeMinutes: 0,
    durationMinutes: 30,
    staffIds: ["murat", "emre"],
    busy: [],
    now: new Date("2026-11-19T12:00:00Z"),
    ...overrides,
  };
}

const times = (i: AvailabilityInput) => computeSlots(i).map((s) => s.time);
const free = (i: AvailabilityInput, time: string) =>
  computeSlots(i).find((s) => s.time === time)?.freeStaffIds;

describe("computeSlots", () => {
  it("kapanıştan önce biten saatleri listeler", () => {
    const t = times(input());
    expect(t[0]).toBe("09:00");
    expect(t.at(-1)).toBe("11:30");
    expect(t).toHaveLength(11);
  });

  it("kapalı günde ya da usta yokken boş döner", () => {
    expect(computeSlots(input({ hours: null }))).toEqual([]);
    expect(computeSlots(input({ staffIds: [] }))).toEqual([]);
  });

  it("öğle arasına değen saatleri çıkarır", () => {
    const t = times(input({ lunch: { start: toMinutes("10:00"), end: toMinutes("10:30") } }));
    expect(t).toContain("09:30");
    expect(t).not.toContain("09:45");
    expect(t).not.toContain("10:15");
    expect(t).toContain("10:30");
  });

  it("şu andan itibaren en geç kuralına uyar", () => {
    const t = times(input({ now: at("09:50"), minNoticeMinutes: 30 }));
    expect(t[0]).toBe("10:30");
  });

  it("dolu ustayı o saatte boş göstermez", () => {
    const i = input({ busy: [{ staffId: "murat", startsAt: at("10:00"), blockedUntil: at("10:30") }] });
    expect(free(i, "10:00")).toEqual(["emre"]);
    expect(free(i, "09:45")).toEqual(["emre"]);
    expect(free(i, "10:30")).toEqual(["murat", "emre"]);
  });

  it("randevular arası boşluğu iki yönde korur", () => {
    const i = input({
      bufferMinutes: 10,
      busy: [{ staffId: "murat", startsAt: at("10:00"), blockedUntil: at("10:40") }],
    });
    // 09:30 + 30 dk + 10 dk boşluk = 10:10'a kadar dolu → mevcut randevuya değer.
    expect(free(i, "09:30")).toEqual(["emre"]);
    expect(free(i, "09:15")).toEqual(["murat", "emre"]);
    expect(free(i, "10:30")).toEqual(["emre"]);
    expect(free(i, "10:45")).toEqual(["murat", "emre"]);
  });
});
