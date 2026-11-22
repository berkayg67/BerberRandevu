import Link from "next/link";
import styles from "./legal.module.css";

/** Sayfa altlarındaki yasal bağlantılar. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav className={`${styles.links} ${className ?? ""}`} aria-label="Yasal bilgiler">
      <Link href="/yasal/musteri-aydinlatma">Aydınlatma metni</Link>
      <Link href="/yasal/kullanim-kosullari">Kullanım koşulları</Link>
      <Link href="/yasal/cerez">Çerezler</Link>
    </nav>
  );
}
