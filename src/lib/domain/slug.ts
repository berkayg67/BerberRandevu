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
