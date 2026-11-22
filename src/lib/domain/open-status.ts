import { addDays, toMinutes, utcToZoned, weekdayOf } from "./time";

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

type Hours = { weekday: number; opens: string; closes: string }[];

/** "Şu an açık, 21:00'e kadar" gibi kısa durum cümlesi. */
export function openStatus(
  hours: Hours,
  lunch: { start: string; end: string } | null,
  timeZone: string,
  now: Date,
): { open: boolean; text: string } {
  const { date, minutes } = utcToZoned(now, timeZone);
  const today = hours.find((h) => h.weekday === weekdayOf(date));
  if (today) {
    const o = toMinutes(today.opens);
    const c = toMinutes(today.closes);
    if (minutes >= o && minutes < c) {
      if (lunch && minutes >= toMinutes(lunch.start) && minutes < toMinutes(lunch.end)) {
        return { open: false, text: `Öğle arası, ${lunch.end}'te açılıyor` };
      }
      return { open: true, text: `Şu an açık, ${today.closes}'e kadar` };
    }
    if (minutes < o) return { open: false, text: `Bugün ${today.opens}'da açılıyor` };
  }
  for (let i = 1; i <= 7; i++) {
    const next = hours.find((h) => h.weekday === weekdayOf(addDays(date, i)));
    if (next) {
      const when = i === 1 ? "yarın" : DAYS[next.weekday];
      return { open: false, text: `Şu an kapalı, ${when} ${next.opens}'da açılıyor` };
    }
  }
  return { open: false, text: "Şu an randevu alınmıyor" };
}
