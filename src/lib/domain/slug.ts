const MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** "Berber Murat Dursun" → "berber-murat-dursun" */
export function slugify(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıiöşüâîû]/g, (c) => MAP[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Sistem sayfalarıyla çakışan adresler dükkân adresi olamaz. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "panel",
  "api",
  "yasal",
  "giris",
  "kayit",
  "www",
  "tasarim",
  "manifest",
  "robots",
  "sitemap",
  "icon",
  "apple-icon",
  "favicon",
  "icerik-bildir",
  "tirasvakti",
  "_next",
]);

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Berberin yazdığı adresi düzenler ("Erhan Kaya!" → "erhan-kaya"). */
export function cleanSlugInput(text: string): string {
  return slugify(text).slice(0, SLUG_MAX).replace(/-+$/g, "");
}

/** Adres kurallarına uymuyorsa nedenini Türkçe döner. */
export function slugProblem(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `Adres en az ${SLUG_MIN} karakter olmalı.`;
  if (slug.length > SLUG_MAX) return `Adres en fazla ${SLUG_MAX} karakter olabilir.`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Adreste yalnızca harf, rakam ve tire olabilir.";
  if (RESERVED_SLUGS.has(slug)) return "Bu adres sistem tarafından kullanılıyor, başka bir tane seçin.";
  return null;
}
