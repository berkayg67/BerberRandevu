import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { sessions, users } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { hashPassword, verifyPassword } from "./password";

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
