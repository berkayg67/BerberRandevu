/**
 * Dükkân fotoğrafları. Tarayıcı fotoğrafı yüklemeden önce küçültür; sunucu yine de
 * türünü, boyutunu ve sayısını denetler.
 */
import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { BookingError } from "@/server/booking/errors";
import { shopPhotos, shops, staff } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 1_500_000;
const MIMES = new Set(["image/jpeg", "image/webp"]);

const fail = (message: string): never => {
  throw new BookingError("INVALID_INPUT", message);
};

export async function listPhotos(db: Db, shopId: string) {
  return db
    .select({ id: shopPhotos.id, width: shopPhotos.width, height: shopPhotos.height })
    .from(shopPhotos)
    .where(and(eq(shopPhotos.shopId, shopId), eq(shopPhotos.kind, "gallery")))
    .orderBy(asc(shopPhotos.sort), asc(shopPhotos.createdAt));
}

/** Dükkân logosu ile usta fotoğraflarının kimlikleri (panel ve müşteri sayfası için). */
export async function listPortraits(db: Db, shopId: string) {
  const rows = await db
    .select({ id: shopPhotos.id, kind: shopPhotos.kind, staffId: shopPhotos.staffId })
    .from(shopPhotos)
    .where(and(eq(shopPhotos.shopId, shopId), eq(shopPhotos.kind, "logo")));
  const staffRows = await db
    .select({ id: shopPhotos.id, staffId: shopPhotos.staffId })
    .from(shopPhotos)
    .where(and(eq(shopPhotos.shopId, shopId), eq(shopPhotos.kind, "staff")));
  return {
    logoId: rows[0]?.id ?? null,
    staffPhotos: Object.fromEntries(staffRows.map((r) => [r.staffId!, r.id])) as Record<string, string>,
  };
}

/** JPEG ve WebP dosyalarını ilk baytlarından tanır; uzantıya ya da beyana güvenmez. */
export function sniffImage(bytes: Uint8Array): "image/jpeg" | "image/webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

type PhotoInput = { data: Uint8Array; width: number; height: number };

function checkImage(input: PhotoInput) {
  const mime = sniffImage(input.data);
  if (!mime || !MIMES.has(mime)) fail("Yalnızca fotoğraf (JPEG ya da WebP) yüklenebilir.");
  if (input.data.byteLength > MAX_PHOTO_BYTES) fail("Fotoğraf çok büyük.");
  const w = Math.round(input.width);
  const h = Math.round(input.height);
  if (!(w > 0 && h > 0 && w <= 4000 && h <= 4000)) fail("Fotoğraf ölçüleri geçersiz.");
  return { mime: mime!, w, h };
}

export async function addPhoto(db: Db, shopId: string, input: PhotoInput) {
  const { mime, w, h } = checkImage(input);
  const [{ n }] = await db
    .select({ n: count() })
    .from(shopPhotos)
    .where(and(eq(shopPhotos.shopId, shopId), eq(shopPhotos.kind, "gallery")));
  if (Number(n) >= MAX_PHOTOS) fail(`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz. Önce birini silin.`);
  const [row] = await db
    .insert(shopPhotos)
    .values({ shopId, mime, data: input.data, width: w, height: h, sort: Number(n) })
    .returning({ id: shopPhotos.id });
  return row;
}

/** Dükkân logosunu ekler ya da değiştirir (dükkânın tek logosu olur). */
export async function setLogo(db: Db, shopId: string, input: PhotoInput) {
  const { mime, w, h } = checkImage(input);
  return db.transaction(async (tx) => {
    await tx.delete(shopPhotos).where(and(eq(shopPhotos.shopId, shopId), eq(shopPhotos.kind, "logo")));
    const [row] = await tx
      .insert(shopPhotos)
      .values({ shopId, kind: "logo", mime, data: input.data, width: w, height: h })
      .returning({ id: shopPhotos.id });
    return row;
  });
}

/** Ustanın fotoğrafını ekler ya da değiştirir. Usta bu dükkâna ait olmalı. */
export async function setStaffPhoto(db: Db, shopId: string, staffId: string, input: PhotoInput) {
  const { mime, w, h } = checkImage(input);
  const [member] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.shopId, shopId)));
  if (!member) fail("Usta bulunamadı.");
  return db.transaction(async (tx) => {
    await tx.delete(shopPhotos).where(and(eq(shopPhotos.staffId, staffId), eq(shopPhotos.kind, "staff")));
    const [row] = await tx
      .insert(shopPhotos)
      .values({ shopId, kind: "staff", staffId, mime, data: input.data, width: w, height: h })
      .returning({ id: shopPhotos.id });
    return row;
  });
}

export async function deletePhoto(db: Db, shopId: string, photoId: string) {
  await db.delete(shopPhotos).where(and(eq(shopPhotos.id, photoId), eq(shopPhotos.shopId, shopId)));
}

/** Fotoğrafı öne alır: seçileni ilk sıraya koyar, diğerlerinin sırasını korur. */
export async function makeCover(db: Db, shopId: string, photoId: string) {
  const list = await listPhotos(db, shopId);
  if (!list.some((p) => p.id === photoId)) fail("Fotoğraf bulunamadı.");
  const order = [photoId, ...list.map((p) => p.id).filter((id) => id !== photoId)];
  await db.transaction(async (tx) => {
    for (const [sort, id] of order.entries()) {
      await tx.update(shopPhotos).set({ sort }).where(eq(shopPhotos.id, id));
    }
  });
}

/** Herkese açık görüntüleme: yalnızca onaylı dükkânların fotoğrafları. */
export async function getPublicPhoto(db: Db, photoId: string) {
  const [row] = await db
    .select({ mime: shopPhotos.mime, data: shopPhotos.data })
    .from(shopPhotos)
    .innerJoin(shops, eq(shops.id, shopPhotos.shopId))
    .where(and(eq(shopPhotos.id, photoId), isNotNull(shops.approvedAt)));
  return row ?? null;
}

/** Berberin kendi paneli için: dükkân onaylı olmasa da görür. */
export async function getOwnPhoto(db: Db, shopId: string, photoId: string) {
  const [row] = await db
    .select({ mime: shopPhotos.mime, data: shopPhotos.data })
    .from(shopPhotos)
    .where(and(eq(shopPhotos.id, photoId), eq(shopPhotos.shopId, shopId)));
  return row ?? null;
}

/** Yönetici için: dükkân onaylı olmasa da fotoğrafı getirir. */
export async function getAnyPhoto(db: Db, photoId: string) {
  const [row] = await db.select({ mime: shopPhotos.mime, data: shopPhotos.data }).from(shopPhotos).where(eq(shopPhotos.id, photoId));
  return row ?? null;
}
