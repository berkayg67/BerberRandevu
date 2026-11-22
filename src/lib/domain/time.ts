/**
 * Saat dilimi yardımcıları. Veritabanı UTC saklar; dükkânın günü ve saatleri
 * kendi saat diliminde (varsayılan Europe/Istanbul) hesaplanır.
 */

/** Yerel gün, "2026-11-20" biçiminde. */
export type LocalDate = string;

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^(\d{2}):(\d{2})(?::\d{2})?$/;

export function isLocalDate(value: string): value is LocalDate {
  if (!LOCAL_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "09:30" veya Postgres'in "09:30:00" biçimi → 570 */
export function toMinutes(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  if (!m) throw new Error(`Geçersiz saat: ${hhmm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Geçersiz saat: ${hhmm}`);
  return h * 60 + min;
}

/** 570 → "09:30" */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 0 = Pazar ... 6 = Cumartesi */
export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Verilen anda saat diliminin UTC'den farkı (dakika). İstanbul için +180. */
function offsetMinutes(timeZone: string, instant: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Dükkânın yerel günü ve saati → UTC an. */
export function zonedToUtc(date: LocalDate, minutes: number, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const asIfUtc = Date.UTC(y, m - 1, d, 0, minutes);
  const first = asIfUtc - offsetMinutes(timeZone, new Date(asIfUtc)) * 60_000;
  // Yaz saati geçişlerinde ikinci tahmin doğru farkı verir.
  const second = asIfUtc - offsetMinutes(timeZone, new Date(first)) * 60_000;
  return new Date(second);
}

/** UTC an → dükkânın yerel günü ve gün içindeki dakikası. */
export function utcToZoned(instant: Date, timeZone: string): { date: LocalDate; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** Dükkânın saat dilimine göre bugünün tarihi. */
export function todayIn(timeZone: string, now: Date): LocalDate {
  return utcToZoned(now, timeZone).date;
}

/** "20 Kasım Cuma" */
export function formatDayTr(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone,
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(instant);
}

/** "10:15" */
export function formatTimeTr(instant: Date, timeZone: string): string {
  return toHHMM(utcToZoned(instant, timeZone).minutes);
}
