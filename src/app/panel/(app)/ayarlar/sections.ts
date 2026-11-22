import type { Settings } from "@/server/panel/settings";

/** Ayar menüsü: sıra, başlık ve her satırın altındaki özet. */
export const SECTIONS: { slug: string; title: string; hint: (s: Settings) => string }[] = [
  { slug: "dukkan", title: "Dükkân bilgileri", hint: (s) => `${s.profile.name}, ${s.profile.district}` },
  { slug: "fotograflar", title: "Logo ve fotoğraflar", hint: () => "Müşteri sayfasında görünür" },
  {
    slug: "saatler",
    title: "Çalışma saatleri ve tatil",
    hint: (s) => `Haftada ${s.week.filter((d) => d.hours).length} gün açık`,
  },
  { slug: "kurallar", title: "Randevu kuralları", hint: (s) => `${s.rules.slotMinutes} dk aralık, ${s.rules.bookAheadDays} gün ileriye` },
  {
    slug: "hizmetler",
    title: "Hizmetler ve fiyatlar",
    hint: (s) => `${s.services.filter((x) => x.active).length} hizmet`,
  },
  { slug: "ustalar", title: "Ustalar", hint: (s) => `${s.staff.filter((x) => x.active).length} usta` },
  { slug: "iletisim", title: "İletişim ve bildirim", hint: (s) => s.contact.address },
  { slug: "hesap", title: "Hesap ve güvenlik", hint: () => "E-posta, şifre" },
];
