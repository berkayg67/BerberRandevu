/**
 * "İçeriği bildir" (5651 sayılı Kanun kapsamında yer sağlayıcı yükümlülüğü).
 * Herkes, bir dükkân sayfasındaki fotoğraf, metin ya da başka bir içeriği bildirebilir;
 * yönetici bildirimi inceler, gerekirse içeriği kaldırır ve sonucu not eder.
 */
import { desc, eq, isNull, sql } from "drizzle-orm";
import { BookingError } from "@/server/booking/errors";
import { contentReports, shopPhotos, shops } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export const REPORT_REASONS = {
  hukuka_aykiri: "Hukuka aykırı içerik",
  hak_ihlali: "Hakkımı ihlal ediyor (fotoğraf, isim, marka)",
  yaniltici: "Yanıltıcı ya da sahte bilgi",
  uygunsuz: "Uygunsuz içerik",
  diger: "Diğer",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

const fail = (message: string): never => {
  throw new BookingError("INVALID_INPUT", message);
};

export async function submitContentReport(
  db: Db,
  input: { shopSlug?: string; target: string; reason: string; details: string; contact?: string },
) {
  const reason = input.reason as ReportReason;
  if (!(reason in REPORT_REASONS)) fail("Bildirim nedenini seçin.");
  const target = input.target.trim();
  const details = input.details.trim();
  const contact = (input.contact ?? "").trim();
  if (target.length < 3 || target.length > 300) fail("Bildirdiğiniz sayfayı ya da içeriği yazın.");
  if (details.length < 10) fail("Lütfen sorunu en az birkaç cümleyle açıklayın.");
  if (details.length > 2000) fail("Açıklama en fazla 2000 karakter olabilir.");
  if (contact.length > 200) fail("İletişim bilgisi çok uzun.");

  let shopId: string | null = null;
  if (input.shopSlug) {
    const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, input.shopSlug));
    shopId = shop?.id ?? null;
  }
  // Aynı kişinin aynı bildirimi art arda göndermesini önle.
  const [dupe] = await db
    .select({ id: contentReports.id })
    .from(contentReports)
    .where(sql`${contentReports.target} = ${target} and ${contentReports.details} = ${details} and ${contentReports.resolvedAt} is null`);
  if (dupe) return { id: dupe.id };
  const [row] = await db
    .insert(contentReports)
    .values({ shopId, target, reason, details, contact: contact || null })
    .returning({ id: contentReports.id });
  return row;
}

export async function listContentReports(db: Db, opts: { open?: boolean } = {}) {
  return db
    .select({
      id: contentReports.id,
      createdAt: contentReports.createdAt,
      target: contentReports.target,
      reason: contentReports.reason,
      details: contentReports.details,
      contact: contentReports.contact,
      resolvedAt: contentReports.resolvedAt,
      resolution: contentReports.resolution,
      shopId: shops.id,
      shopName: shops.name,
    })
    .from(contentReports)
    .leftJoin(shops, eq(shops.id, contentReports.shopId))
    .where(opts.open ? isNull(contentReports.resolvedAt) : undefined)
    .orderBy(desc(contentReports.createdAt))
    .limit(100);
}

/** Bildirimi sonuçlandırır. removePhotos: dükkânın galeri fotoğrafları kaldırılır. */
export async function resolveContentReport(
  db: Db,
  input: { id: string; resolution: string; removeGallery?: boolean },
  now: Date = new Date(),
) {
  const resolution = input.resolution.trim();
  if (resolution.length < 3) fail("Kararınızı kısaca yazın.");
  const [row] = await db
    .update(contentReports)
    .set({ resolvedAt: now, resolution })
    .where(eq(contentReports.id, input.id))
    .returning({ shopId: contentReports.shopId });
  if (!row) throw new BookingError("NOT_FOUND", "Bildirim bulunamadı.");
  if (input.removeGallery && row.shopId) {
    await db.delete(shopPhotos).where(sql`${shopPhotos.shopId} = ${row.shopId} and ${shopPhotos.kind} = 'gallery'`);
  }
}
