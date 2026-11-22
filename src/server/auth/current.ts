import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { createSession, deleteSession, getSessionUser, type SessionUser } from "./service";

export const SESSION_COOKIE = "berber_oturum";

/** Çerezdeki oturumun kullanıcısı; yoksa null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // Oturum ve sonrasındaki her şey (saat dahil) istek anında hesaplanır;
  // Next.js bu sayfaları önceden hazırlamaya çalışmaz.
  await connection();
  if (!token) return null;
  return getSessionUser(getDb(), token);
}

/** Yönetici değilse giriş sayfasına yönlendirir. Her yönetici sayfası ve işlemi bunu çağırır. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/giris");
  return user;
}

/**
 * Berber hesabı değilse panel girişine yönlendirir. Dönen shopId her panel
 * işleminde kullanılır; istekle gelen dükkân kimliğine asla güvenilmez.
 */
export async function requireOwner(): Promise<SessionUser & { shopId: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner" || !user.shopId) redirect("/panel/giris");
  return { ...user, shopId: user.shopId };
}

/** Yalnızca Server Action içinden çağrılır (çerez yazar). */
export async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(getDb(), userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Yalnızca Server Action içinden çağrılır (çerez siler). */
export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(getDb(), token);
  store.delete(SESSION_COOKIE);
}
