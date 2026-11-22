import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listShopsOverview } from "@/server/admin/service";
import { authenticate, AccountError } from "@/server/auth/service";
import { createAppointment } from "@/server/booking/service";
import { customers, shops } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { addPhoto, deletePhoto, getPublicPhoto, listPhotos, makeCover, MAX_PHOTOS, sniffImage } from "@/server/panel/photos";
import { getPublicShop, getShopBySlug } from "@/server/shops/service";
import {
  approveShop,
  isShopApproved,
  listPendingShops,
  listResetRequests,
  registerShop,
  rejectShop,
  requestPasswordReset,
  resolveResetRequest,
  type SignupInput,
} from "@/server/signup/service";
import { createTestDb } from "./test-db";

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  close = () => t.client.close();
});
afterAll(async () => {
  await close?.();
});

const input = (o: Partial<SignupInput> = {}): SignupInput => ({
  shopName: "Kuzguncuk Berberi",
  district: "Üsküdar",
  address: "İcadiye Cd. No:12, Kuzguncuk",
  ownerName: "Hasan Yılmaz",
  phone: "0532 111 22 33",
  email: "Hasan@Ornek.com",
  password: "makas-1234",
  acceptTerms: true,
  ...o,
});

// En küçük geçerli JPEG başı ve WebP başı; içerik denetimi yalnızca imzaya bakar.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);

describe("berber kaydı", () => {
  it("başvuru onaysız ve kapalı açılır; onaylanınca müşteri sayfası açılır", async () => {
    const { shopId, slug } = await registerShop(db, input());
    expect(await isShopApproved(db, shopId)).toBe(false);
    await expect(getShopBySlug(db, slug)).rejects.toThrow();
    // Onay bekleyen dükkân yönetimin dükkân listesinde değil, başvurularda görünür.
    expect((await listShopsOverview(db)).shops).toHaveLength(0);
    const pending = await listPendingShops(db);
    expect(pending.map((p) => [p.name, p.email, p.ownerPhone])).toEqual([
      ["Kuzguncuk Berberi", "hasan@ornek.com", "5321112233"],
    ]);

    // Şifre doğru olsa da onay gelene kadar giriş akışı engellenir (bkz. loginOwner).
    const user = await authenticate(db, "hasan@ornek.com", "makas-1234");
    expect(user?.shopId).toBe(shopId);

    await approveShop(db, shopId);
    expect(await isShopApproved(db, shopId)).toBe(true);
    expect((await getShopBySlug(db, slug)).name).toBe("Kuzguncuk Berberi");
    expect(await listPendingShops(db)).toEqual([]);
    await expect(approveShop(db, shopId)).rejects.toBeInstanceOf(AccountError);
  });

  it("eksik ya da hatalı bilgiyi ve kayıtlı e-postayı reddeder", async () => {
    await expect(registerShop(db, input({ acceptTerms: false }))).rejects.toThrow(/kullanım koşullarını kabul/);
    await expect(registerShop(db, input({ password: "kisa" }))).rejects.toThrow(/8 karakter/);
    await expect(registerShop(db, input({ phone: "0212 111 22 33" }))).rejects.toThrow(/05 ile/);
    await registerShop(db, input());
    await expect(registerShop(db, input({ shopName: "Başka" }))).rejects.toThrow(/zaten bir hesap/);
  });

  it("reddedilen başvuru dükkân ve hesapla birlikte silinir; onaylı dükkân reddedilemez", async () => {
    const a = await registerShop(db, input());
    await rejectShop(db, a.shopId);
    expect(await db.select().from(shops).where(eq(shops.id, a.shopId))).toEqual([]);
    expect(await authenticate(db, "hasan@ornek.com", "makas-1234")).toBeNull();

    const b = await registerShop(db, input({ email: "b@ornek.com" }));
    await approveShop(db, b.shopId);
    await expect(rejectShop(db, b.shopId)).rejects.toBeInstanceOf(AccountError);
  });
});

describe("şifremi unuttum", () => {
  it("talep kaydedilir, tekrarlanınca çoğalmaz; yönetici yeni şifre üretince eski şifre geçmez", async () => {
    const { shopId } = await registerShop(db, input());
    await approveShop(db, shopId);
    await requestPasswordReset(db, "HASAN@ornek.com ");
    await requestPasswordReset(db, "hasan@ornek.com");
    const list = await listResetRequests(db);
    expect(list.map((r) => [r.email, r.shopName, r.ownerPhone])).toEqual([
      ["hasan@ornek.com", "Kuzguncuk Berberi", "5321112233"],
    ]);

    const { password } = await resolveResetRequest(db, list[0].id);
    expect(await authenticate(db, "hasan@ornek.com", "makas-1234")).toBeNull();
    expect((await authenticate(db, "hasan@ornek.com", password))?.shopId).toBe(shopId);
    expect(await listResetRequests(db)).toEqual([]);
    await expect(resolveResetRequest(db, list[0].id)).rejects.toBeInstanceOf(AccountError);
  });

  it("kayıtlı olmayan e-posta için de aynı sonucu verir ve iz bırakmaz", async () => {
    await expect(requestPasswordReset(db, "yok@ornek.com")).resolves.toBeUndefined();
    expect(await listResetRequests(db)).toEqual([]);
    await expect(requestPasswordReset(db, "e-posta değil")).rejects.toBeInstanceOf(AccountError);
  });
});

describe("dükkân fotoğrafları", () => {
  it("yalnızca JPEG/WebP kabul eder, en fazla altı tane; kapak seçilir; onaysız dükkânınki herkese görünmez", async () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(new TextEncoder().encode("<svg></svg>"))).toBeNull();

    const { shopId, slug } = await registerShop(db, input());
    await expect(addPhoto(db, shopId, { data: new TextEncoder().encode("<svg/>"), width: 10, height: 10 })).rejects.toThrow(
      /JPEG/,
    );
    const ids: string[] = [];
    for (let i = 0; i < MAX_PHOTOS; i++) ids.push((await addPhoto(db, shopId, { data: JPEG, width: 1600, height: 1200 })).id);
    await expect(addPhoto(db, shopId, { data: JPEG, width: 1600, height: 1200 })).rejects.toThrow(/En fazla/);

    expect(await getPublicPhoto(db, ids[0])).toBeNull();
    await approveShop(db, shopId);
    expect((await getPublicPhoto(db, ids[0]))?.mime).toBe("image/jpeg");

    await makeCover(db, shopId, ids[3]);
    expect((await listPhotos(db, shopId))[0].id).toBe(ids[3]);
    await deletePhoto(db, shopId, ids[3]);
    const shop = await getPublicShop(db, slug);
    expect(shop.photos).toHaveLength(MAX_PHOTOS - 1);
    expect(shop.photos.map((p) => p.id)).not.toContain(ids[3]);
  });
});

describe("KVKK açık rızası", () => {
  it("rıza randevunun şartı değildir; yalnızca teşekkür mesajını açar ve rıza zamanı müşteriye yazılır", async () => {
    const { shopId, slug } = await registerShop(db, input());
    await approveShop(db, shopId);
    const now = new Date("2026-11-19T07:00:00Z");
    const shop = await getPublicShop(db, slug, now);
    const base = {
      shopId,
      serviceId: shop.services[0].id,
      staffId: "any",
      date: "2026-11-20",
      source: "online" as const,
    };
    const kinds = (r: Awaited<ReturnType<typeof createAppointment>>) => r.messages.map((m) => m.kind).sort();

    // Rızasız: randevu alınır, onay ve hatırlatma gider, teşekkür gitmez, rıza zamanı boş kalır.
    const a = await createAppointment(
      db,
      { ...base, time: "10:00", customerName: "Ali Veli", customerPhone: "05351234567" },
      now,
    );
    expect(kinds(a)).toEqual(["confirm", "new_booking", "reminder"]);
    const [c1] = await db.select().from(customers).where(eq(customers.phone, "5351234567"));
    expect(c1.consentAt).toBeNull();

    // Rızalı: teşekkür mesajı da planlanır ve rıza zamanı kaydedilir.
    const b = await createAppointment(
      db,
      { ...base, time: "11:00", customerName: "Ayşe Kaya", customerPhone: "05361234567", consent: true },
      now,
    );
    expect(kinds(b)).toEqual(["confirm", "new_booking", "reminder", "thanks"]);
    const [c2] = await db.select().from(customers).where(eq(customers.phone, "5361234567"));
    expect(c2.consentAt?.toISOString()).toBe(now.toISOString());

    // Aynı müşteri sonradan rıza vermezse, daha önce verdiği rıza silinmez.
    await createAppointment(
      db,
      { ...base, date: "2026-11-21", time: "10:00", customerName: "Ayşe Kaya", customerPhone: "05361234567" },
      now,
    );
    const [c3] = await db.select().from(customers).where(eq(customers.phone, "5361234567"));
    expect(c3.consentAt?.toISOString()).toBe(now.toISOString());
  });
});

describe("sistem adresleri", () => {
  it("dükkân adı sistem sayfasıyla çakışırsa adres değişir", async () => {
    const a = await registerShop(db, input({ shopName: "Admin", email: "a@ornek.com" }));
    const b = await registerShop(db, input({ shopName: "Yasal", email: "b@ornek.com" }));
    expect([a.slug, b.slug]).toEqual(["admin-berber", "yasal-berber"]);
  });
});
