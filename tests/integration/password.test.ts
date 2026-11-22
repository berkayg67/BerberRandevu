import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { forgotPassword } from "@/server/auth/forgot";
import { changePassword, checkResetToken, consumeResetToken, createResetToken, updateAccount } from "@/server/auth/reset";
import { AccountError, authenticate, createOwner, createSession, getSessionUser, upsertAdmin } from "@/server/auth/service";
import { passwordResetTokens } from "@/server/db/schema";
import { resetMail, sendMail, type Mail } from "@/server/mail/send";
import { listResetRequests } from "@/server/signup/service";
import type { Db } from "@/server/db/types";
import { createTestDb, seedShop } from "./test-db";

let db: Db;
let close: () => Promise<void>;
let shopId: string;

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  close = () => t.client.close();
  shopId = (await seedShop(db)).shop.id;
});
afterAll(async () => {
  await close?.();
});

const T0 = new Date("2026-11-22T10:00:00Z");
const min = (n: number) => new Date(T0.getTime() + n * 60_000);

async function owner() {
  const { email, password } = await createOwner(db, { shopId, email: "usta@ornek.com", name: "Hasan Yılmaz" });
  const user = (await authenticate(db, email, password))!;
  return { email, password, user };
}

describe("e-postayla şifre sıfırlama", () => {
  it("bağlantı üretir, yeni şifreyle giriş yapılır, bağlantı tek kullanımlıktır", async () => {
    const { email } = await owner();
    const made = (await createResetToken(db, { email, role: "owner" }, T0))!;
    expect(made.token.length).toBeGreaterThan(30);
    // Veritabanında anahtarın kendisi değil özeti durur.
    const rows = await db.select().from(passwordResetTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(made.token);

    expect(await checkResetToken(db, made.token, min(5))).toMatchObject({ role: "owner" });
    await consumeResetToken(db, { token: made.token, password: "yeni-sifre-1", role: "owner" }, min(5));
    expect(await authenticate(db, email, "yeni-sifre-1")).not.toBeNull();
    await expect(
      consumeResetToken(db, { token: made.token, password: "baska-sifre-2", role: "owner" }, min(6)),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it("60 dakikadan sonra geçersiz olur", async () => {
    const { email } = await owner();
    const made = (await createResetToken(db, { email, role: "owner" }, T0))!;
    expect(await checkResetToken(db, made.token, min(61))).toBeNull();
    await expect(
      consumeResetToken(db, { token: made.token, password: "yeni-sifre-1", role: "owner" }, min(61)),
    ).rejects.toThrow(/geçersiz/);
  });

  it("bilinmeyen ya da kapalı hesap için bağlantı üretilmez; rol karışmaz", async () => {
    const { email } = await owner();
    expect(await createResetToken(db, { email: "yok@ornek.com" }, T0)).toBeNull();
    expect(await createResetToken(db, { email, role: "admin" }, T0)).toBeNull();
  });

  it("art arda istek bir dakika içinde yeni bağlantı üretmez; sonra eskisini geçersiz kılar", async () => {
    const { email } = await owner();
    const first = (await createResetToken(db, { email, role: "owner" }, T0))!;
    expect(await createResetToken(db, { email, role: "owner" }, min(0.5))).toBeNull();
    const second = (await createResetToken(db, { email, role: "owner" }, min(2)))!;
    expect(await checkResetToken(db, first.token, min(3))).toBeNull();
    expect(await checkResetToken(db, second.token, min(3))).not.toBeNull();
  });

  it("yönetici bağlantısı berber hesabında, berber bağlantısı yönetici hesabında çalışmaz", async () => {
    const { email } = await owner();
    const made = (await createResetToken(db, { email, role: "owner" }, T0))!;
    await expect(
      consumeResetToken(db, { token: made.token, password: "yeni-sifre-1", role: "admin" }, min(1)),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it("kısa şifre ve bozuk anahtar reddedilir; şifre değişince açık oturumlar kapanır", async () => {
    const { email, user } = await owner();
    const { token: session } = await createSession(db, user.id, T0);
    const made = (await createResetToken(db, { email, role: "owner" }, T0))!;
    await expect(consumeResetToken(db, { token: made.token, password: "kisa", role: "owner" }, min(1))).rejects.toThrow(/en az 8/);
    await expect(consumeResetToken(db, { token: "x", password: "yeni-sifre-1", role: "owner" }, min(1))).rejects.toThrow(/geçersiz/);
    await consumeResetToken(db, { token: made.token, password: "yeni-sifre-1", role: "owner" }, min(1));
    expect(await getSessionUser(db, session, min(2))).toBeNull();
  });
});

describe("şifremi unuttum akışı", () => {
  const sent: Mail[] = [];
  const send = async (m: Mail) => {
    sent.push(m);
    return { sent: true } as const;
  };
  beforeEach(() => {
    sent.length = 0;
  });

  it("e-posta servisi açıkken bağlantı gönderilir ve yanıt kullanıcıdan bağımsızdır", async () => {
    const { email } = await owner();
    const known = await forgotPassword(db, { email, role: "owner", origin: "https://tirasvakti.test" }, { send, mailReady: true, now: T0 });
    const unknown = await forgotPassword(db, { email: "yok@ornek.com", role: "owner", origin: "https://tirasvakti.test" }, { send, mailReady: true, now: T0 });
    expect(known).toEqual(unknown);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
    expect(sent[0].text).toMatch(/https:\/\/tirasvakti\.test\/panel\/sifre-sifirla\?token=[\w-]+/);
  });

  it("yönetici bağlantısı /admin adresine gider", async () => {
    await upsertAdmin(db, { email: "yonetici@ornek.com", name: "Berkay", password: "gizli-sifre-9" });
    await forgotPassword(db, { email: "yonetici@ornek.com", role: "admin", origin: "https://tirasvakti.test" }, { send, mailReady: true, now: T0 });
    expect(sent[0].text).toContain("https://tirasvakti.test/admin/sifre-sifirla?token=");
  });

  it("e-posta servisi yokken berber talebi yöneticiye düşer, yönetici için komut gösterilir", async () => {
    const { email } = await owner();
    expect(await forgotPassword(db, { email, role: "owner", origin: "x" }, { send, mailReady: false })).toEqual({ mode: "admin" });
    expect(await listResetRequests(db)).toHaveLength(1);
    expect(await forgotPassword(db, { email, role: "admin", origin: "x" }, { send, mailReady: false })).toEqual({ mode: "manual" });
    expect(sent).toHaveLength(0);
  });

  it("e-posta gönderilemezse berber talebi yöneticiye düşer", async () => {
    const { email } = await owner();
    await forgotPassword(
      db,
      { email, role: "owner", origin: "x" },
      { send: async () => ({ sent: false, reason: "failed" }), mailReady: true, now: T0 },
    );
    expect(await listResetRequests(db)).toHaveLength(1);
  });

  it("geçersiz e-posta hata verir", async () => {
    await expect(forgotPassword(db, { email: "bozuk", role: "owner", origin: "x" }, { send, mailReady: true })).rejects.toBeInstanceOf(AccountError);
  });
});

describe("şifre ve hesap değiştirme", () => {
  it("mevcut şifre doğrulanır; diğer oturumlar kapanır, bu oturum kalır", async () => {
    const { password, user } = await owner();
    const a = await createSession(db, user.id, T0);
    const b = await createSession(db, user.id, T0);
    const { createHash } = await import("node:crypto");
    const keep = createHash("sha256").update(a.token).digest("hex");
    await expect(changePassword(db, { userId: user.id, current: "yanlis", next: "yeni-sifre-1", keepSessionId: keep })).rejects.toThrow(/Mevcut şifre yanlış/);
    await expect(changePassword(db, { userId: user.id, current: password, next: "kisa", keepSessionId: keep })).rejects.toThrow(/en az 8/);
    await expect(changePassword(db, { userId: user.id, current: password, next: password })).rejects.toThrow(/aynı olamaz/);
    await changePassword(db, { userId: user.id, current: password, next: "yeni-sifre-1", keepSessionId: keep });
    expect(await getSessionUser(db, a.token, min(1))).not.toBeNull();
    expect(await getSessionUser(db, b.token, min(1))).toBeNull();
    expect(await authenticate(db, "usta@ornek.com", "yeni-sifre-1")).not.toBeNull();
    expect(await authenticate(db, "usta@ornek.com", password)).toBeNull();
  });

  it("e-posta değişikliği şifreyle onaylanır ve başka hesapla çakışamaz", async () => {
    const { password, user } = await owner();
    await upsertAdmin(db, { email: "yonetici@ornek.com", name: "Berkay", password: "gizli-sifre-9" });
    await expect(updateAccount(db, { userId: user.id, name: "Hasan", email: "yeni@ornek.com", password: "yanlis" })).rejects.toThrow(/Şifre yanlış/);
    await expect(updateAccount(db, { userId: user.id, name: "Hasan", email: "Yonetici@Ornek.com", password })).rejects.toThrow(/zaten bir hesap/);
    const r = await updateAccount(db, { userId: user.id, name: "  Hasan   Usta ", email: "Yeni@Ornek.com", password });
    expect(r).toEqual({ name: "Hasan Usta", email: "yeni@ornek.com", changedEmail: true });
    expect(await authenticate(db, "yeni@ornek.com", password)).not.toBeNull();
  });
});

describe("e-posta gönderimi", () => {
  it("anahtar yoksa gönderilmez", async () => {
    expect(await sendMail({ to: "a@b.co", subject: "s", text: "t" }, { env: {} })).toEqual({ sent: false, reason: "not_configured" });
  });

  it("Resend'e doğru istek gider; hata durumunda failed döner", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const env = { RESEND_API_KEY: "re_test", MAIL_FROM: "Tıraş Vakti <bildirim@ornek.com>" };
    expect(await sendMail(resetMail({ to: "a@b.co", name: "Hasan Yılmaz", link: "https://x.test/l?token=abc", minutes: 60 }), { env, fetch: ok })).toEqual({ sent: true });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ from: env.MAIL_FROM, to: ["a@b.co"] });
    expect(body.text).toContain("Merhaba Hasan");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer re_test");

    const bad = (async () => new Response("no", { status: 422 })) as unknown as typeof fetch;
    expect(await sendMail({ to: "a@b.co", subject: "s", text: "t" }, { env, fetch: bad })).toEqual({ sent: false, reason: "failed" });
  });
});

