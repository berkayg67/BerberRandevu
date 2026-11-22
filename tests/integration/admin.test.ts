import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { shopInfo } from "@/server/api/handlers";
import {
  AdminError,
  createShop,
  getShopForAdmin,
  listShopsOverview,
  recordPayment,
  removePayment,
  setShopActive,
  updateShop,
  type ShopInput,
} from "@/server/admin/service";
import {
  authenticate,
  createSession,
  deleteSession,
  getSessionUser,
  upsertAdmin,
} from "@/server/auth/service";
import type { Db } from "@/server/db/types";
import { createTestDb } from "./test-db";

const NOW = new Date("2026-11-19T12:00:00Z");

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

const input = (overrides: Partial<ShopInput> = {}): ShopInput => ({
  name: "Berber Murat Dursun",
  district: "Üsküdar",
  address: "Murat Reis, Silahtarbahçe Sk. 23/A",
  phone: "0532 483 84 79",
  notifyPhone: "0532 483 84 79",
  ownerName: "Murat Dursun",
  ownerPhone: "0532 483 84 79",
  monthlyFeeKurus: 75_000,
  billingStart: "2026-09-15",
  adminNotes: null,
  ...overrides,
});

describe("yönetici girişi", () => {
  it("doğru bilgilerle giriş, yanlışla red; oturum açılır ve kapanır", async () => {
    await upsertAdmin(db, { email: "Berkay@Ornek.com", name: "Berkay", password: "kx7m-2pqa-9dfe-wz4h" });
    expect(await authenticate(db, "berkay@ornek.com", "yanlis")).toBeNull();
    expect(await authenticate(db, "yok@ornek.com", "kx7m-2pqa-9dfe-wz4h")).toBeNull();

    const user = await authenticate(db, " BERKAY@ornek.com ", "kx7m-2pqa-9dfe-wz4h");
    expect(user).toMatchObject({ email: "berkay@ornek.com", role: "admin", shopId: null });

    const { token } = await createSession(db, user!.id, NOW);
    expect((await getSessionUser(db, token, NOW))?.email).toBe("berkay@ornek.com");
    // 15 gün sonra oturum geçersiz.
    expect(await getSessionUser(db, token, new Date(NOW.getTime() + 15 * 86_400_000))).toBeNull();
    await deleteSession(db, token);
    expect(await getSessionUser(db, token, NOW)).toBeNull();
  });

  it("şifre yenilenince eski oturumlar kapanır", async () => {
    await upsertAdmin(db, { email: "a@b.co", name: "A", password: "eski-sifre-1234" });
    const user = await authenticate(db, "a@b.co", "eski-sifre-1234");
    const { token } = await createSession(db, user!.id, NOW);
    const again = await upsertAdmin(db, { email: "a@b.co", name: "A", password: "yeni-sifre-5678" });
    expect(again.created).toBe(false);
    expect(await getSessionUser(db, token, NOW)).toBeNull();
    expect(await authenticate(db, "a@b.co", "eski-sifre-1234")).toBeNull();
    expect(await authenticate(db, "a@b.co", "yeni-sifre-5678")).not.toBeNull();
  });
});

describe("dükkân yönetimi", () => {
  it("dükkân açar: benzersiz adres, varsayılan saatler, hizmetler ve usta", async () => {
    const a = await createShop(db, input());
    const b = await createShop(db, input());
    expect(a.slug).toBe("berber-murat-dursun");
    expect(b.slug).toBe("berber-murat-dursun-2");
    expect(a.notifyPhone).toBe("5324838479");

    const info = (await shopInfo(db, a.slug, NOW)).body as {
      services: unknown[];
      staff: { name: string }[];
      hours: unknown[];
    };
    expect(info.services).toHaveLength(6);
    expect(info.staff.map((s) => s.name)).toEqual(["Murat"]);
    expect(info.hours).toHaveLength(6);
  });

  it("geçersiz telefonu reddeder", async () => {
    await expect(createShop(db, input({ notifyPhone: "0216 123 45 67" }))).rejects.toBeInstanceOf(AdminError);
  });

  it("durdurulan dükkân müşterilere görünmez, tekrar açılınca görünür", async () => {
    const shop = await createShop(db, input());
    await setShopActive(db, shop.id, false);
    expect((await shopInfo(db, shop.slug, NOW)).status).toBe(404);
    await setShopActive(db, shop.id, true);
    expect((await shopInfo(db, shop.slug, NOW)).status).toBe(200);
  });

  it("bilgileri günceller", async () => {
    const shop = await createShop(db, input());
    const updated = await updateShop(db, shop.id, { ...input({ name: "Murat Usta", monthlyFeeKurus: 90_000 }), active: true });
    expect(updated.name).toBe("Murat Usta");
    expect(updated.slug).toBe("berber-murat-dursun"); // adres değişmez, müşteri linkleri bozulmaz
    expect(updated.monthlyFeeKurus).toBe(90_000);
  });
});

describe("tahsilat", () => {
  it("bekleyen ayları hesaplar, tahsilatı işaretler ve geri alır", async () => {
    const admin = await upsertAdmin(db, { email: "a@b.co", name: "A", password: "x-x-x-x-x-x" }).then(() =>
      authenticate(db, "a@b.co", "x-x-x-x-x-x"),
    );
    const shop = await createShop(db, input()); // Eylül 2026'dan beri, ayda 750 ₺

    let detail = await getShopForAdmin(db, shop.id, NOW);
    expect(detail?.currentPeriod).toBe("2026-11");
    expect(detail?.periods.map((p) => p.period)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(detail?.unpaidPeriods).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(detail?.unpaidKurus).toBe(225_000);

    await recordPayment(db, { shopId: shop.id, period: "2026-09", amountKurus: 75_000, method: "nakit", note: null, recordedBy: admin!.id }, NOW);
    await recordPayment(db, { shopId: shop.id, period: "2026-11", amountKurus: 70_000, method: "havale", note: "indirimli", recordedBy: admin!.id }, NOW);
    // Aynı ay ikinci kez işaretlenirse güncellenir, kopya oluşmaz.
    await recordPayment(db, { shopId: shop.id, period: "2026-11", amountKurus: 75_000, method: "havale", note: null, recordedBy: admin!.id }, NOW);

    detail = await getShopForAdmin(db, shop.id, NOW);
    expect(detail?.unpaidPeriods).toEqual(["2026-10"]);
    expect(detail?.currentPaid).toBe(true);
    expect(detail?.periods.find((p) => p.period === "2026-11")?.payment?.amountKurus).toBe(75_000);

    const overview = await listShopsOverview(db, NOW);
    expect(overview.totals).toEqual({ active: 1, collectedThisMonthKurus: 75_000, outstandingKurus: 75_000 });
    expect(overview.shops[0]).toMatchObject({ name: "Berber Murat Dursun", currentPaid: true, unpaidPeriods: ["2026-10"] });

    await removePayment(db, shop.id, "2026-11");
    expect((await getShopForAdmin(db, shop.id, NOW))?.currentPaid).toBe(false);
  });

  it("ücretsiz dükkânda borç oluşmaz", async () => {
    const shop = await createShop(db, input({ monthlyFeeKurus: 0 }));
    const detail = await getShopForAdmin(db, shop.id, NOW);
    expect(detail?.unpaidKurus).toBe(0);
    expect(detail?.currentDue).toBe(false);
  });
});
