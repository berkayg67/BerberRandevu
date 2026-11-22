import type { Metadata } from "next";
import Link from "next/link";
import { LegalHeader } from "@/components/legal/LegalFrame";
import styles from "@/components/legal/legal.module.css";
import { LEGAL_DOCS } from "@/lib/legal/docs";

export const metadata: Metadata = { title: "Yasal bilgiler" };

export default function LegalIndex() {
  return (
    <div className={styles.page}>
      <LegalHeader />
      <main className={styles.main}>
        <h1 className={styles.h1}>Yasal bilgiler</h1>
        <ul className={styles.index}>
          {LEGAL_DOCS.map((d) => (
            <li key={d.slug}>
              <Link href={`/yasal/${d.slug}`}>
                <b>{d.title}</b>
                <span>{d.short}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
