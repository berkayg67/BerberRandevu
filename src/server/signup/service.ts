/**
 * Berberlerin kendi kaydolması, yönetici onayı ve "şifremi unuttum" talepleri.
 *
 * Akış:
 * 1. Berber kayıt formunu doldurur. Dükkân kapalı ve onaysız açılır, hesap şifresiyle birlikte oluşur.
 * 2. Onaylanana kadar giriş yapamaz; müşteri sayfası da açılmaz.
 * 3. Yönetici başvuruyu onaylar (dükkân açılır) ya da reddeder (dükkân ve hesap silinir).
 */
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { formatPhone, normalizePhone } from "@/lib/domain/phone";
import { AccountError, resetOwnerPassword } from "@/server/auth/service";
import { hashPassword } from "@/server/auth/password";
import { createShop } from "@/server/admin/service";
import { passwordResetRequests, shops, users } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

export type SignupInput = {
  shopName: string;
  district: string;
  address: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
  acceptTerms: boolean;
};

/** Kayıt başvurusu. Doğrulama hatasında AccountError fırlatır. */
export async function registerShop(db: Db, input: SignupInput, now: Date = new Date()) {
  const shopName = input.shopName.trim();
  const district = input.district.trim();
  const address = input.address.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);

  if (shopName.length < 2 || shopName.length > 60) throw new AccountError("Dükkân adını yazın.");
  if (district.length < 2) throw new AccountError("İlçeyi yazın.");
  if (address.length < 5) throw new AccountError("Açık adresi yazın.");
  if (ownerName.length < 2) throw new AccountError("Adınızı ve soyadınızı yazın.");
  if (!phone) throw new AccountError("Cep telefonu 05 ile başlayan 11 haneli olmalı.");
  if (!EMAIL.test(email)) throw new AccountError("Geçerli bir e-posta adresi yazın.");
  if (input.password.length < MIN_PASSWORD) throw new AccountError(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
  if (!input.acceptTerms) throw new AccountError("Devam etmek için kullanım koşullarını kabul edin.");

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (taken) throw new AccountError("Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.");

  const passwordHash = await hashPassword(input.password);
  const shop = await createShop(db, {
    name: shopName,
    district,
    address,
    phone: formatPhone(phone),
    notifyPhone: phone,
    ownerName,
    ownerPhone: phone,
    monthlyFeeKurus: 0,
    billingStart: now.toISOString().slice(0, 10),
    adminNotes: null,
  });
  // createShop yöneticinin açtığı dükkânı onaylı açar; başvuru onay bekler.
  await db.update(shops).set({ active: false, approvedAt: null }).where(eq(shops.id, shop.id));
  await db.insert(users).values({
    email,
    name: ownerName,
    passwordHash,
    role: "owner",
    shopId: shop.id,
    termsAcceptedAt: now,
  });
  return { shopId: shop.id, slug: shop.slug };
}

/** Dükkân başvurusu onaylandı mı? Yönetici açtıysa her zaman onaylıdır. */
export async function isShopApproved(db: Db, shopId: string) {
  const [shop] = await db.select({ approvedAt: shops.approvedAt }).from(shops).where(eq(shops.id, shopId));
  return Boolean(shop?.approvedAt);
}

export async function listPendingShops(db: Db) {
  return db
    .select({
      id: shops.id,
      name: shops.name,
      district: shops.district,
      address: shops.address,
      ownerName: shops.ownerName,
      ownerPhone: shops.ownerPhone,
      email: users.email,
      createdAt: shops.createdAt,
    })
    .from(shops)
    .leftJoin(users, and(eq(users.shopId, shops.id), eq(users.role, "owner")))
    .where(isNull(shops.approvedAt))
    .orderBy(asc(shops.createdAt));
}

export async function approveShop(db: Db, shopId: string, now: Date = new Date()) {
  const [row] = await db
    .update(shops)
    .set({ approvedAt: now, active: true })
    .where(and(eq(shops.id, shopId), isNull(shops.approvedAt)))
    .returning({ id: shops.id });
  if (!row) throw new AccountError("Başvuru bulunamadı ya da zaten onaylanmış.");
}

/** Başvuruyu reddeder: onaysız dükkân ve hesabı silinir. Onaylı dükkâna dokunmaz. */
export async function rejectShop(db: Db, shopId: string) {
  const [row] = await db
    .delete(shops)
    .where(and(eq(shops.id, shopId), isNull(shops.approvedAt)))
    .returning({ id: shops.id });
  if (!row) throw new AccountError("Başvuru bulunamadı ya da zaten onaylanmış.");
}

/* ------------------------------------------------------------------ */
/* Şifremi unuttum                                                     */
/* ------------------------------------------------------------------ */

/**
 * Talep kaydeder. Hesap olsun olmasın aynı yanıt verilir; böylece form,
 * hangi e-postaların kayıtlı olduğunu öğrenmek için kullanılamaz.
 */
export async function requestPasswordReset(db: Db, rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new AccountError("Geçerli bir e-posta adresi yazın.");
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, "owner")));
  if (!user) return;
  const [open] = await db
    .select({ id: passwordResetRequests.id })
    .from(passwordResetRequests)
    .where(and(eq(passwordResetRequests.userId, user.id), isNull(passwordResetRequests.resolvedAt)));
  if (!open) await db.insert(passwordResetRequests).values({ userId: user.id });
}

export async function listResetRequests(db: Db) {
  return db
    .select({
      id: passwordResetRequests.id,
      createdAt: passwordResetRequests.createdAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      shopId: shops.id,
      shopName: shops.name,
      ownerPhone: shops.ownerPhone,
    })
    .from(passwordResetRequests)
    .innerJoin(users, eq(users.id, passwordResetRequests.userId))
    .innerJoin(shops, eq(shops.id, users.shopId))
    .where(isNull(passwordResetRequests.resolvedAt))
    .orderBy(desc(passwordResetRequests.createdAt));
}

/** Talebi kapatır ve yeni şifre üretir. Şifre bir kez gösterilir. */
export async function resolveResetRequest(db: Db, requestId: string, now: Date = new Date()) {
  const [req] = await db
    .select({ userId: users.id, shopId: users.shopId })
    .from(passwordResetRequests)
    .innerJoin(users, eq(users.id, passwordResetRequests.userId))
    .where(and(eq(passwordResetRequests.id, requestId), isNull(passwordResetRequests.resolvedAt)));
  if (!req?.shopId) throw new AccountError("Talep bulunamadı ya da zaten sonuçlandı.");
  const result = await resetOwnerPassword(db, { shopId: req.shopId, userId: req.userId });
  await db
    .update(passwordResetRequests)
    .set({ resolvedAt: now })
    .where(eq(passwordResetRequests.userId, req.userId));
  return result;
}

/** Talebi şifre üretmeden kapatır (ör. berber şifresini hatırladı). */
export async function dismissResetRequest(db: Db, requestId: string, now: Date = new Date()) {
  await db
    .update(passwordResetRequests)
    .set({ resolvedAt: now })
    .where(eq(passwordResetRequests.id, requestId));
}
