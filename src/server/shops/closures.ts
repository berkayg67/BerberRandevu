import { and, asc, eq, gte, lte } from "drizzle-orm";
import { addDays, type LocalDate } from "@/lib/domain/time";
import { shopClosures } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** [from, to] aralığındaki kapalı günler (dahil), "YYYY-MM-DD" listesi olarak. */
export async function closedDatesBetween(db: Db, shopId: string, from: LocalDate, to: LocalDate): Promise<Set<string>> {
  const rows = await db
    .select({ startsOn: shopClosures.startsOn, endsOn: shopClosures.endsOn })
    .from(shopClosures)
    .where(and(eq(shopClosures.shopId, shopId), lte(shopClosures.startsOn, to), gte(shopClosures.endsOn, from)))
    .orderBy(asc(shopClosures.startsOn));
  const out = new Set<string>();
  for (const r of rows) {
    // Yıllarca süren bir kayıt bile en fazla istenen aralık kadar gün üretir.
    let d: LocalDate = r.startsOn < from ? from : r.startsOn;
    const end = r.endsOn > to ? to : r.endsOn;
    while (d <= end) {
      out.add(d);
      d = addDays(d, 1);
    }
  }
  return out;
}

export async function isDateClosed(db: Db, shopId: string, date: LocalDate): Promise<boolean> {
  return (await closedDatesBetween(db, shopId, date, date)).has(date);
}
