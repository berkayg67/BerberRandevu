import { toHHMM, zonedToUtc, type LocalDate } from "./time";

/** Bir ustanın dolu olduğu aralık: [startsAt, blockedUntil). blockedUntil = bitiş + boşluk. */
export type BusyInterval = {
  staffId: string;
  startsAt: Date;
  blockedUntil: Date;
};

export type AvailabilityInput = {
  date: LocalDate;
  timeZone: string;
  /** O günün çalışma saatleri (dakika). Kapalı gün için null. */
  hours: { opens: number; closes: number } | null;
  /** Öğle arası (dakika). Yoksa null. */
  lunch: { start: number; end: number } | null;
  slotMinutes: number;
  bufferMinutes: number;
  /** Şu andan en az kaç dakika sonrasına randevu verilir. Dükkândan eklerken 0. */
  minNoticeMinutes: number;
  durationMinutes: number;
  /** Bu hizmeti verebilecek aktif ustalar, sıralı. */
  staffIds: string[];
  busy: BusyInterval[];
  now: Date;
};

export type Slot = {
  /** "09:30" */
  time: string;
  minutes: number;
  startsAt: Date;
  /** Bu saatte boş olan ustalar. Boşsa saat doludur. */
  freeStaffIds: string[];
};

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Bir günün randevu saatlerini hesaplar.
 * Dönen listede çalışma saati içindeki, öğle arasına denk gelmeyen ve
 * yeterince ileride olan tüm saatler bulunur; dolu olanların freeStaffIds'i boştur.
 */
export function computeSlots(input: AvailabilityInput): Slot[] {
  const { hours, lunch } = input;
  if (!hours || input.staffIds.length === 0) return [];

  const earliest = input.now.getTime() + input.minNoticeMinutes * 60_000;
  const slots: Slot[] = [];

  for (
    let m = hours.opens;
    m + input.durationMinutes <= hours.closes;
    m += input.slotMinutes
  ) {
    if (lunch && overlaps(m, m + input.durationMinutes, lunch.start, lunch.end)) continue;

    const startsAt = zonedToUtc(input.date, m, input.timeZone);
    if (startsAt.getTime() < earliest) continue;

    const start = startsAt.getTime();
    const blockedUntil = start + (input.durationMinutes + input.bufferMinutes) * 60_000;
    const freeStaffIds = input.staffIds.filter(
      (staffId) =>
        !input.busy.some(
          (b) =>
            b.staffId === staffId &&
            overlaps(start, blockedUntil, b.startsAt.getTime(), b.blockedUntil.getTime()),
        ),
    );

    slots.push({ time: toHHMM(m), minutes: m, startsAt, freeStaffIds });
  }
  return slots;
}
