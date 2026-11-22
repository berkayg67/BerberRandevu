import { describe, expect, it } from "vitest";
import { formatPeriodTr, nextPeriod, periodsBetween } from "@/lib/domain/period";
import { slugify } from "@/lib/domain/slug";
import { generatePassword, hashPassword, verifyPassword } from "@/server/auth/password";

describe("slugify", () => {
  it("Türkçe harfleri sadeleştirir", () => {
    expect(slugify("Berber Murat Dursun")).toBe("berber-murat-dursun");
    expect(slugify("AŞKIN BARBER Hair Design shop")).toBe("askin-barber-hair-design-shop");
    expect(slugify("Çengelköy Güzel Şık Ücra İnci")).toBe("cengelkoy-guzel-sik-ucra-inci");
    expect(slugify("  --  ")).toBe("");
  });
});

describe("dönemler", () => {
  it("ay ve yıl geçişleri", () => {
    expect(nextPeriod("2026-12")).toBe("2027-01");
    expect(periodsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(periodsBetween("2026-12", "2026-11")).toEqual([]);
    expect(formatPeriodTr("2026-11")).toBe("Kasım 2026");
  });
});

describe("şifreler", () => {
  it("doğru şifreyi kabul eder, yanlışı reddeder; özet her seferinde farklıdır", async () => {
    const a = await hashPassword("çok-gizli-şifre");
    const b = await hashPassword("çok-gizli-şifre");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("çok-gizli-şifre", a)).toBe(true);
    expect(await verifyPassword("cok-gizli-sifre", a)).toBe(false);
    expect(await verifyPassword("x", "bozuk")).toBe(false);
  });

  it("üretilen şifreler güçlü ve okunaklı", () => {
    const p = generatePassword();
    expect(p).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(generatePassword()).not.toBe(p);
  });
});
