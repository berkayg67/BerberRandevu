/**
 * Tıraş Vakti'ni işleten kişi ya da şirketin bilgileri. Yasal metinlerin hepsi buradan okunur.
 * Yayına almadan önce köşeli parantezli alanları gerçek bilgilerle değiştirin (bkz. COMPANY_READY).
 */
export const COMPANY = {
  /** Gerçek kişi için ad soyad, şirket için ticaret unvanı. */
  name: "[Ad Soyad veya Ticaret Unvanı]",
  /** Tebligat adresi. */
  address: "[Açık adres]",
  /** KVKK başvuruları ve destek için e-posta. */
  email: "[iletisim@alanadi.com]",
  /** Varsa Kayıtlı Elektronik Posta (KEP) adresi; yoksa boş bırakın. */
  kep: "",
  /** Vergi kimlik numarası veya MERSİS numarası; yoksa boş bırakın. */
  registryNo: "",
} as const;

/** Köşeli parantezli alan kaldıysa metinler hâlâ taslaktır. */
export const COMPANY_READY = ![COMPANY.name, COMPANY.address, COMPANY.email].some((v) => v.startsWith("["));

export const LEGAL_UPDATED = "22 Kasım 2026";
