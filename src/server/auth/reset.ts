/**
 * Şifre sıfırlama ve değiştirme. Berber ve yönetici hesapları aynı kodu kullanır.
 *
 * - Sıfırlama bağlantısı 60 dakika geçerlidir ve tek kullanımlıktır; veritabanında yalnızca
 *   SHA-256 özeti durur.
 * - Kullanıcı bulunsa da bulunmasa da dışarıya aynı yanıt verilir (hesap var mı yok mu açığa çıkmaz).
 * - Şifre değişince tüm açık oturumlar kapanır.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { passwordResetTokens, sessions, users } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { AccountError } from "./service";
import { hashPassword, verifyPassword } from "./password";

export const RESET_MINUTES = 60;
const COOLDOWN_SECONDS = 60;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Şifre en az ${MIN_PASSWORD} karakter olmalı.`;
  if (password.length > MAX_PASSWORD) return `Şifre en fazla ${MAX_PASSWORD} karakter olabilir.`;
  if (/^\s+$/.test(password)) return "Şifre yalnızca boşluktan oluşamaz.";
  return null;
}

/**
 * Şifre sıfırlama anahtarı üretir. Kullanıcı yoksa, kapalıysa ya da çok sık istenmişse null döner;
 * çağıran taraf her durumda kullanıcıya aynı mesajı gösterir.
 */
export async function createResetToken(
  db: Db,
  input: { email: string; role?: "admin" | "owner" },
  now: Date = new Date(),
) {
  const email = input.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.active) return null;
  if (input.role && user.role !== input.role) return null;

  // Son dakikada zaten bir bağlantı gönderildiyse yenisini üretme (e-posta bombardımanını önler).
  const recent = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        gt(passwordResetTokens.createdAt, new Date(now.getTime() - COOLDOWN_SECONDS * 1000)),
      ),
    );
  if (recent.length > 0) return null;

  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    // Eski bağlantılar geçersiz olur; süresi dolanlar temizlenir.
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await tx.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now));
    await tx.insert(passwordResetTokens).values({
      id: hashToken(token),
      userId: user.id,
      expiresAt: new Date(now.getTime() + RESET_MINUTES * 60_000),
      createdAt: now,
    });
  });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

/** Bağlantı hâlâ geçerli mi? Sayfa açılırken "bağlantı geçersiz" uyarısı için. */
export async function checkResetToken(db: Db, token: string, now: Date = new Date()) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ role: users.role, email: users.email })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(and(eq(passwordResetTokens.id, hashToken(token)), gt(passwordResetTokens.expiresAt, now), eq(users.active, true)));
  return row ?? null;
}

/** Bağlantıyla yeni şifre belirler; bağlantı tüketilir, açık oturumlar kapanır. */
export async function consumeResetToken(
  db: Db,
  input: { token: string; password: string; role: "admin" | "owner" },
  now: Date = new Date(),
) {
  const problem = passwordProblem(input.password);
  if (problem) throw new AccountError(problem);
  const invalid = new AccountError("Bu bağlantı geçersiz ya da süresi dolmuş. Yeniden şifre sıfırlama isteyin.");
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(input.token)) throw invalid;
  const id = hashToken(input.token);
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    // Tek kullanım: silme işlemi başarılıysa bağlantı bu istek tarafından tüketilmiştir.
    const [row] = await tx
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.id, id), gt(passwordResetTokens.expiresAt, now)))
      .returning({ userId: passwordResetTokens.userId });
    if (!row) throw invalid;
    const [user] = await tx
      .update(users)
      .set({ passwordHash })
      .where(and(eq(users.id, row.userId), eq(users.role, input.role), eq(users.active, true)))
      .returning({ id: users.id, email: users.email });
    if (!user) throw invalid;
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    return user;
  });
}

/** Giriş yapmış kullanıcı şifresini değiştirir. Mevcut şifre doğrulanır; diğer oturumlar kapanır. */
export async function changePassword(
  db: Db,
  input: { userId: string; current: string; next: string; keepSessionId?: string },
) {
  const problem = passwordProblem(input.next);
  if (problem) throw new AccountError(problem);
  const [user] = await db.select().from(users).where(eq(users.id, input.userId));
  if (!user || !(await verifyPassword(input.current, user.passwordHash))) {
    throw new AccountError("Mevcut şifre yanlış.");
  }
  if (input.current === input.next) throw new AccountError("Yeni şifre mevcut şifreyle aynı olamaz.");
  await db.update(users).set({ passwordHash: await hashPassword(input.next) }).where(eq(users.id, user.id));
  // Başka cihazlardaki oturumlar kapanır; bu cihaz açık kalır.
  const all = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, user.id));
  for (const s of all) {
    if (s.id !== input.keepSessionId) await db.delete(sessions).where(eq(sessions.id, s.id));
  }
}

/** Hesap sahibi adını ve e-postasını değiştirir (şifre doğrulanır). */
export async function updateAccount(
  db: Db,
  input: { userId: string; name: string; email: string; password: string },
) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 80) throw new AccountError("Adınızı yazın.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountError("Geçerli bir e-posta adresi yazın.");
  const [user] = await db.select().from(users).where(eq(users.id, input.userId));
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AccountError("Şifre yanlış.");
  }
  if (email !== user.email) {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (taken) throw new AccountError("Bu e-posta adresiyle zaten bir hesap var.");
  }
  await db.update(users).set({ name, email }).where(eq(users.id, user.id));
  return { name, email, changedEmail: email !== user.email };
}
