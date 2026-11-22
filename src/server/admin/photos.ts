import { and, asc, eq } from "drizzle-orm";
import { shopPhotos } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** Yönetici incelemesi için dükkânın tüm fotoğrafları (galeri, logo, usta). */
export async function listAllShopPhotos(db: Db, shopId: string) {
  return db
    .select({ id: shopPhotos.id, kind: shopPhotos.kind, staffId: shopPhotos.staffId, width: shopPhotos.width, height: shopPhotos.height })
    .from(shopPhotos)
    .where(eq(shopPhotos.shopId, shopId))
    .orderBy(asc(shopPhotos.kind), asc(shopPhotos.sort), asc(shopPhotos.createdAt));
}

export async function removeShopPhoto(db: Db, shopId: string, photoId: string) {
  await db.delete(shopPhotos).where(and(eq(shopPhotos.id, photoId), eq(shopPhotos.shopId, shopId)));
}
