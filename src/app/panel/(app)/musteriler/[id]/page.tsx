import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dayLabel } from "@/components/booking/format";
import { BlockForm } from "@/components/panel/BlockForm";
import styles from "@/components/panel/panel.module.css";
import { UnblockButton } from "@/components/panel/UnblockButton";
import { SaveForm } from "@/components/panel/SaveForm";
import { updateCustomerAction } from "@/app/panel/actions";
import { formatPrice } from "@/lib/domain/money";
import { formatPhone, toWhatsAppNumber } from "@/lib/domain/phone";
import { formatTimeTr, utcToZoned } from "@/lib/domain/time";
import { requireOwner } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { getCustomer } from "@/server/panel/customers";
import { getPanelShop } from "@/server/panel/service";

export const metadata: Metadata = { title: "Müşteri", robots: { index: false } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CustomerPage({ params }: PageProps<"/panel/musteriler/[id]">) {
  return (
    <main className={styles.main}>
      <Link href="/panel/musteriler" className={styles.back}>
        Tüm müşteriler
      </Link>
      <Suspense fallback={<p className={styles.sub}>Yükleniyor…</p>}>
        <Customer params={params} />
      </Suspense>
    </main>
  );
}

async function Customer({ params }: { params: Promise<{ id: string }> }) {
  const { shopId } = await requireOwner();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = getDb();
  const [shop, data] = await Promise.all([getPanelShop(db, shopId), getCustomer(db, shopId, id)]);
  if (!data) notFound();
  const { customer, block, stats, history } = data;

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>{customer.name}</h1>
          <p className={styles.sub}>{formatPhone(customer.phone)}</p>
        </div>
        {block && <span className="tag tag-red">Engelli</span>}
      </div>

      <div className={styles.row2} style={{ marginBottom: 14 }}>
        <a className="btn btn-quiet" href={`tel:0${customer.phone}`}>
          Ara
        </a>
        <a className="btn btn-wa" href={`https://wa.me/${toWhatsAppNumber(customer.phone)}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </div>

      <div className={styles.stats}>
        <div>
          <b>{stats.visits}</b>
          <span>Geldi</span>
        </div>
        <div>
          <b>{stats.noShows}</b>
          <span>Gelmedi</span>
        </div>
        <div>
          <b>{formatPrice(stats.spentKurus)}</b>
          <span>Toplam</span>
        </div>
      </div>

      <h2 className={styles.h2}>Bilgiler ve not</h2>
      <SaveForm action={updateCustomerAction.bind(null, customer.id)} className={styles.card}>
        <div style={{ paddingTop: 12 }}>
          <div className="field">
            <label htmlFor="cu-name">Ad soyad</label>
            <input id="cu-name" name="name" className="input" defaultValue={customer.name} autoCapitalize="words" />
          </div>
          <div className="field">
            <label htmlFor="cu-phone">Cep telefonu</label>
            <input id="cu-phone" name="phone" className="input" inputMode="tel" defaultValue={formatPhone(customer.phone)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="cu-note">
              Not <span className="hint">yalnızca siz görürsünüz</span>
            </label>
            <textarea id="cu-note" name="note" className="input" rows={3} maxLength={300} defaultValue={customer.note ?? ""} placeholder="Örn. 2 numara, sakalı kısa sever" />
          </div>
        </div>
      </SaveForm>

      <h2 className={styles.h2}>Geçmiş</h2>
      <div className="group">
        {history.map((h) => {
          const local = utcToZoned(h.startsAt, shop.timezone);
          return (
            <div key={h.id} className={styles.histRow}>
              <span>
                <b style={{ fontWeight: 600 }}>
                  {dayLabel(local.date, shop.today, shop.timezone)}, {formatTimeTr(h.startsAt, shop.timezone)}
                </b>
                <span className={styles.sub} style={{ display: "block", marginTop: 0 }}>
                  {h.serviceName}, {h.staffName}
                </span>
              </span>
              {h.status === "cancelled" ? (
                <span className="tag tag-red">İptal</span>
              ) : h.noShow ? (
                <span className="tag tag-yellow">Gelmedi</span>
              ) : h.past ? (
                <span className="tag tag-grey">Geldi</span>
              ) : (
                <span className="tag tag-green">Sırada</span>
              )}
            </div>
          );
        })}
      </div>

      <h2 className={styles.h2}>{block ? "Engel" : "Engelle"}</h2>
      {block ? (
        <div className={styles.blockCard} style={{ paddingBottom: 14 }}>
          <p style={{ marginBottom: 10 }}>{block.note ? `Not: ${block.note}` : "Not eklenmemiş."}</p>
          <UnblockButton blockId={block.id} className="btn btn-quiet" />
        </div>
      ) : (
        <>
          <p className={styles.sub} style={{ marginBottom: 12 }}>
            Engellenince bu kişi online randevu alamaz. Yaklaşan {stats.upcoming > 0 ? `${stats.upcoming} randevusu iptal edilir ve kendisine haber verilir.` : "randevusu yok."}
          </p>
          <BlockForm name={customer.name} phone={customer.phone} />
        </>
      )}
    </>
  );
}
