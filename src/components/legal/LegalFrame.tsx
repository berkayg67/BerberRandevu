import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LEGAL_UPDATED } from "@/lib/legal/company";
import type { LegalDoc } from "@/lib/legal/docs";
import styles from "./legal.module.css";

export function LegalHeader() {
  return (
    <header className={styles.head}>
      <Link href="/" aria-label="Tıraş Vakti ana sayfa">
        <Logo size={28} />
      </Link>
      <Link href="/yasal" className={styles.all}>
        Tüm yasal bilgiler
      </Link>
    </header>
  );
}

export function LegalFrame({ doc }: { doc: LegalDoc }) {
  return (
    <div className={styles.page}>
      <LegalHeader />
      <main className={styles.main}>
        <h1 className={styles.h1}>{doc.title}</h1>
        <p className={styles.updated}>Son güncelleme: {LEGAL_UPDATED}</p>
        <p className={styles.lead}>{doc.intro}</p>
        {doc.blocks.map((b, i) => (
          <section key={b.h ?? i} className={styles.block}>
            {b.h && <h2 className={styles.h2}>{b.h}</h2>}
            {b.p?.map((t) => (
              <p key={t}>{t}</p>
            ))}
            {b.ul && (
              <ul>
                {b.ul.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
