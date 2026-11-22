/** İsim karşılaştırması için: Türkçe küçük harf, tek boşluk. "  AHMET  Işık" → "ahmet ışık" */
export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

/** İlk isim: "Ahmet Yılmaz" → "Ahmet" */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
