import { describe, expect, it } from "vitest";
import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal/docs";

describe("yasal metinler", () => {
  it("arayüzün bağlandığı bütün metinler var ve adresleri tekrar etmiyor", () => {
    const slugs = LEGAL_DOCS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of ["musteri-aydinlatma", "acik-riza", "berber-aydinlatma", "kullanim-kosullari", "cerez"]) {
      expect(getLegalDoc(s), s).toBeDefined();
    }
  });

  it("aydınlatma metinleri veri sorumlusunu, amacı, aktarımı ve hakları söyler", () => {
    for (const s of ["musteri-aydinlatma", "berber-aydinlatma"]) {
      const text = JSON.stringify(getLegalDoc(s));
      for (const part of ["Veri sorumlusu", "hukuki sebep", "aktarıl", "Haklarınız", "Kurulu"]) {
        expect(text, `${s}: ${part}`).toContain(part);
      }
    }
  });

  it("açık rıza metni isteğe bağlı olduğunu ve geri alınabileceğini açıkça yazar", () => {
    const text = JSON.stringify(getLegalDoc("acik-riza"));
    expect(text).toContain("şartı değildir");
    expect(text).toContain("geri al");
  });
});
