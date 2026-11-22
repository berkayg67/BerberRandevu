export type BookingErrorCode =
  | "INVALID_INPUT"
  | "INVALID_PHONE"
  | "NOT_FOUND"
  | "BLOCKED"
  | "SLOT_UNAVAILABLE"
  | "SLOT_TAKEN"
  | "ALREADY_CANCELLED"
  | "TOO_LATE";

/** Kullanıcıya gösterilebilecek, beklenen randevu hataları. */
export class BookingError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

/** PostgreSQL'in çakışma kuralı (exclusion constraint) ihlali mi? */
export function isOverlapViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i++) {
    if (typeof current === "object" && current !== null && "code" in current) {
      if ((current as { code?: unknown }).code === "23P01") return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
