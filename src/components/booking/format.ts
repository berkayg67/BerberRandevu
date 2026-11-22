import { addDays, formatDayTr, weekdayOf, zonedToUtc, type LocalDate } from "@/lib/domain/time";

export const DAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
export const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** "Bugün", "Yarın" ya da "20 Kasım Cuma" */
export function dayLabel(date: LocalDate, today: LocalDate, timeZone: string): string {
  if (date === today) return "Bugün";
  if (date === addDays(today, 1)) return "Yarın";
  return formatDayTr(zonedToUtc(date, 12 * 60, timeZone), timeZone);
}

/** Bugünden son randevu gününe kadar tüm günler; kapalı olanlar işaretli. */
export function bookableDays(today: LocalDate, last: LocalDate, openWeekdays: Set<number>) {
  const days: { date: LocalDate; open: boolean; weekday: number; day: number; month: number }[] = [];
  for (let d = today; d <= last && days.length < 90; d = addDays(d, 1)) {
    const [, m, day] = d.split("-").map(Number);
    const weekday = weekdayOf(d);
    days.push({ date: d, open: openWeekdays.has(weekday), weekday, day, month: m - 1 });
  }
  return days;
}

/** Saatleri sabah / öğleden sonra / akşam olarak gruplar. */
export function groupSlots<T extends { time: string }>(slots: T[]) {
  const groups: { title: string; slots: T[] }[] = [
    { title: "Sabah", slots: [] },
    { title: "Öğleden sonra", slots: [] },
    { title: "Akşam", slots: [] },
  ];
  for (const s of slots) {
    const h = Number(s.time.slice(0, 2));
    groups[h < 12 ? 0 : h < 17 ? 1 : 2].slots.push(s);
  }
  return groups.filter((g) => g.slots.length > 0);
}
