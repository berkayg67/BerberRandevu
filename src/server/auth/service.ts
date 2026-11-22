import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { sessions, users } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { generatePassword, hashPassword, verifyPassword } from "./password";

export const SESSION_DAYS = 14;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "owner";
  shopId: string | null;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Kullanıcı bulunamasa bile aynı sürede yanıt vermek için sahte özet.
let dummyHash: Promise<string> | undefined;

/** E-posta ve şifreyi doğrular. Hangi bilginin yanlış olduğunu açığa çıkarmaz. */
export async function authenticate(db: Db, email: string, password: string): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalized));
  if (!user || !user.active) {
    dummyHash ??= hashPassword("zamanlama-esitleme");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, shopId: user.shopId };
}

/** Yeni oturum açar; çereze yazılacak anahtarı döner. */
export async function createSession(db: Db, userId: string, now: Date = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, userId));
  // Süresi dolmuş eski oturumları temizle.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, now)));
  return { token, expiresAt };
}

export async function getSessionUser(db: Db, token: string, now: Date = new Date()): Promise<SessionUser | null> {
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, now), eq(users.active, true)));
  if (!row) return null;
  const u = row.user;
  return { id: u.id, email: u.email, name: u.name, role: u.role, shopId: u.shopId };
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Yönetici hesabı oluşturur ya da şifresini yeniler. */
export async function upsertAdmin(db: Db, input: { email: string; name: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const [existing] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email));
  if (existing) {
    if (existing.role !== "admin") throw new Error("Bu e-posta bir dükkân hesabına ait.");
    await db.update(users).set({ name: input.name, passwordHash, active: true }).where(eq(users.id, existing.id));
    // Şifre değişince tüm açık oturumlar kapanır.
    await db.delete(sessions).where(eq(sessions.userId, existing.id));
    return { created: false };
  }
  await db.insert(users).values({ email, name: input.name, passwordHash, role: "admin" });
  return { created: true };
}

/* ------------------------------------------------------------------ */
/* Dükkân (berber) hesapları                                           */
/* ------------------------------------------------------------------ */

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bir dükkâna giriş hesabı açar. Şifreyi üretir ve bir kez döner. */
export async function createOwner(db: Db, input: { shopId: string; email: string; name: string }) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!EMAIL.test(email)) throw new AccountError("Geçerli bir e-posta adresi yazın.");
  if (name.length < 2) throw new AccountError("Hesap sahibinin adını yazın.");
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (taken) throw new AccountError("Bu e-posta adresiyle zaten bir hesap var.");
  const password = generatePassword();
  await db.insert(users).values({
    email,
    name,
    passwordHash: await hashPassword(password),
    role: "owner",
    shopId: input.shopId,
  });
  return { email, password };
}

/** Dükkân hesabının şifresini yeniler; açık oturumları kapatır. */
export async function resetOwnerPassword(db: Db, input: { shopId: string; userId: string }) {
  const password = generatePassword();
  const [user] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), active: true })
    .where(and(eq(users.id, input.userId), eq(users.shopId, input.shopId), eq(users.role, "owner")))
    .returning({ email: users.email });
  if (!user) throw new AccountError("Hesap bulunamadı.");
  await db.delete(sessions).where(eq(sessions.userId, input.userId));
  return { email: user.email, password };
}

/** Dükkân hesabını kapatır ya da açar. Kapatınca açık oturumlar da kapanır. */
export async function setOwnerActive(db: Db, input: { shopId: string; userId: string; active: boolean }) {
  await db
    .update(users)
    .set({ active: input.active })
    .where(and(eq(users.id, input.userId), eq(users.shopId, input.shopId), eq(users.role, "owner")));
  if (!input.active) await db.delete(sessions).where(eq(sessions.userId, input.userId));
}

export async function listOwners(db: Db, shopId: string) {
  return db
    .select({ id: users.id, email: users.email, name: users.name, active: users.active, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(and(eq(users.shopId, shopId), eq(users.role, "owner")));
}
