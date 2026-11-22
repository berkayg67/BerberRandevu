/** Abonelik dönemleri "2026-11" biçimindedir. */
export type Period = string;

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function periodOf(localDate: string): Period {
  return localDate.slice(0, 7);
}

export function nextPeriod(period: Period): Period {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Başlangıç ve bitiş dahil tüm aylar, eskiden yeniye. */
export function periodsBetween(from: Period, to: Period): Period[] {
  const out: Period[] = [];
  for (let p = from; p <= to && out.length < 600; p = nextPeriod(p)) out.push(p);
  return out;
}

/** "2026-11" → "Kasım 2026" */
export function formatPeriodTr(period: Period): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
