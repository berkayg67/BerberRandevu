import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
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

/** Açık oturumun veritabanındaki kimliği (çerezdeki anahtarın özeti). */
export async function currentSessionId(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? createHash("sha256").update(token).digest("hex") : undefined;
}

/**
 * Sitenin adresi (şifre sıfırlama bağlantıları için). SITE_URL tanımlıysa o kullanılır;
 * değilse isteğin kendi adresi. Canlıda SITE_URL tanımlamak en güvenlisidir.
 */
export async function siteOrigin(): Promise<string> {
  const fixed = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed && /^https?:\/\//.test(fixed)) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
