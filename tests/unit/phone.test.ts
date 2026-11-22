import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, toWhatsAppNumber } from "@/lib/domain/phone";
import { normalizeName } from "@/lib/domain/names";
import { formatPrice } from "@/lib/domain/money";

describe("normalizePhone", () => {
  it.each([
    ["0532 123 45 67", "5321234567"],
    ["05321234567", "5321234567"],
    ["5321234567", "5321234567"],
    ["+90 532 123 4567", "5321234567"],
    ["90 (532) 123-45-67", "5321234567"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(["0212 123 45 67", "0532 123 45", "", "abc", "053212345678"])(
    "%s geçersiz",
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    },
  );

  it("biçimlendirir", () => {
    expect(formatPhone("5321234567")).toBe("0532 123 45 67");
    expect(toWhatsAppNumber("5321234567")).toBe("905321234567");
  });
});

describe("normalizeName", () => {
  it("Türkçe büyük-küçük harfe ve boşluklara duyarsız", () => {
    expect(normalizeName("  AHMET   IŞIK ")).toBe(normalizeName("ahmet ışık"));
    expect(normalizeName("İSMAİL")).toBe("ismail");
  });
});

describe("formatPrice", () => {
  it("kuruşu liraya çevirir", () => {
    expect(formatPrice(70000)).toBe("700 ₺");
    expect(formatPrice(150000)).toBe("1.500 ₺");
    expect(formatPrice(12550)).toBe("125,50 ₺");
  });
});
