import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { dayLabel } from "@/components/booking/format";
import { BlockForm } from "@/components/panel/BlockForm";
import styles from "@/components/panel/panel.module.css";
import { UnblockButton } from "@/components/panel/UnblockButton";
import { formatPhone } from "@/lib/domain/phone";
import { utcToZoned } from "@/lib/domain/time";
import { requireOwner } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { listBlocks, listCustomers, type CustomerListItem } from "@/server/panel/customers";
import { getPanelShop } from "@/server/panel/service";

export const metadata: Metadata = { title: "Müşteriler", robots: { index: false } };

export default function CustomersPage({ searchParams }: PageProps<"/panel/musteriler">) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p className={styles.sub}>Yükleniyor…</p>}>
        <Customers searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function subline(c: CustomerListItem, today: string, tz: string) {
  const when = (d: Date) => dayLabel(utcToZoned(d, tz).date, today, tz).toLocaleLowerCase("tr-TR");
  if (c.nextAt) return `Sıradaki randevu: ${when(c.nextAt)}`;
  if (c.lastAt) return `Son gelişi: ${when(c.lastAt)}`;
  return formatPhone(c.phone);
}

async function Customers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { shopId } = await requireOwner();
  const db = getDb();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.slice(0, 40) : "";
  const [shop, list, blocks] = await Promise.all([getPanelShop(db, shopId), listCustomers(db, shopId, q), listBlocks(db, shopId)]);

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Müşteriler</h1>
          <p className={styles.sub}>Randevu alan herkes burada listelenir.</p>
        </div>
      </div>

      <form className={styles.search} role="search">
        <input name="q" type="search" className="input" placeholder="İsim ya da telefon" defaultValue={q} aria-label="Müşteri ara" />
        <button type="submit" className="btn btn-quiet">
          Ara
        </button>
      </form>

      {list.length === 0 ? (
        <div className="empty">{q ? `“${q}” ile eşleşen müşteri yok.` : "Henüz müşteri yok. İlk randevu alındığında burada görünecek."}</div>
      ) : (
        <div className="group">
          {list.map((c) => (
            <Link key={c.id} href={`/panel/musteriler/${c.id}`} className={styles.custRow}>
              <span className={`${styles.avatar} ${c.blocked ? styles.avatarBlocked : ""}`} aria-hidden="true">
                {c.name.charAt(0).toLocaleUpperCase("tr-TR")}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className={styles.custName}>
                  <span>{c.name}</span>
                  {c.blocked && <span className="tag tag-red">Engelli</span>}
                  {c.noShows > 0 && <span className="tag tag-yellow">{c.noShows} kez gelmedi</span>}
                </span>
                <span className={styles.sub} style={{ display: "block", marginTop: 0 }}>
                  {subline(c, shop.today, shop.timezone)}
                </span>
              </span>
              <span className={styles.count}>
                <b>{c.visits}</b>
                ziyaret
              </span>
            </Link>
          ))}
        </div>
      )}

      <h2 className={styles.h2}>Engellenenler</h2>
      <p className={styles.sub} style={{ marginBottom: 12 }}>
        Engellenen kişi bu isim ya da numarayla online randevu alamaz; yalnızca sizi araması söylenir.
      </p>
      {blocks.length > 0 && (
        <div className="group" style={{ marginBottom: 12 }}>
          {blocks.map((b) => (
            <div key={b.id} className={styles.histRow}>
              <span>
                <b style={{ fontWeight: 600 }}>{b.name ?? "İsimsiz"}</b>
                <span className={styles.sub} style={{ display: "block", marginTop: 0 }}>
                  {[b.phone ? formatPhone(b.phone) : null, b.note].filter(Boolean).join(". ") || "Not yok"}
                </span>
              </span>
              <UnblockButton blockId={b.id} className={styles.back} />
            </div>
          ))}
        </div>
      )}
      <BlockForm />
    </>
  );
}
