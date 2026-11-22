import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { dayLabel } from "@/components/booking/format";
import styles from "@/components/panel/panel.module.css";
import { formatTimeTr, utcToZoned } from "@/lib/domain/time";
import { requireOwner } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { listMessages, type MessageFilter } from "@/server/panel/messages";
import { getPanelShop } from "@/server/panel/service";

export const metadata: Metadata = { title: "Mesajlar", robots: { index: false } };

const FILTERS: [MessageFilter, string][] = [
  ["sirada", "Sırada"],
  ["gonderildi", "Gönderilen"],
  ["iptal", "Gönderilmeyecek"],
  ["hepsi", "Tümü"],
];
const KIND: Record<string, string> = {
  confirm: "Randevu onayı",
  new_booking: "Yeni randevu bildirimi",
  cancel_customer: "İptal bildirimi",
  cancel_shop: "İptal bildirimi",
  reminder: "Hatırlatma",
  thanks: "Teşekkür ve yorum isteği",
};

export default function MessagesPage({ searchParams }: PageProps<"/panel/mesajlar">) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p className={styles.sub}>Yükleniyor…</p>}>
        <Messages searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Messages({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { shopId } = await requireOwner();
  const raw = (await searchParams).durum;
  const filter = (FILTERS.find(([k]) => k === raw)?.[0] ?? "sirada") as MessageFilter;
  const db = getDb();
  const [shop, data] = await Promise.all([getPanelShop(db, shopId), listMessages(db, shopId, filter)]);
  const tz = shop.timezone;
  const when = (d: Date) => `${dayLabel(utcToZoned(d, tz).date, shop.today, tz)}, ${formatTimeTr(d, tz)}`;

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Mesajlar</h1>
          <p className={styles.sub}>Müşterilerinize ve size giden WhatsApp mesajları.</p>
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 14 }}>
        Randevu alınınca ve iptal edilince müşteriye ve size mesaj gider; müşteriye ayrıca hatırlatma ve teşekkür mesajı
        gider. WhatsApp bağlantısı kurulana kadar mesajlar burada sırada bekler.
      </div>

      <nav className={styles.filters} aria-label="Mesaj durumu">
        {FILTERS.map(([key, label]) => (
          <Link key={key} href={key === "sirada" ? "/panel/mesajlar" : `/panel/mesajlar?durum=${key}`} className="chip" aria-pressed={filter === key}>
            {label}
          </Link>
        ))}
      </nav>

      {data.messages.length === 0 ? (
        <div className="empty">Bu listede mesaj yok.</div>
      ) : (
        <div className={styles.msgList}>
          {data.messages.map((m) => (
            <article key={m.id} className={styles.msg}>
              <div className={styles.msgHead}>
                <span>
                  <b>{m.recipient === "shop" ? "Size" : (m.customerName ?? "Müşteri")}</b>{" "}
                  <span className="kind">{KIND[m.kind]}</span>
                </span>
                {m.status === "sent" ? (
                  <span className="tag tag-green">Gönderildi</span>
                ) : m.status === "cancelled" ? (
                  <span className="tag tag-grey">Gönderilmeyecek</span>
                ) : m.status === "failed" ? (
                  <span className="tag tag-red">Gönderilemedi</span>
                ) : (
                  <span className="tag tag-yellow">Sırada</span>
                )}
              </div>
              <div className={`bubble ${m.recipient === "shop" ? styles.bubbleShop : ""}`}>{m.body}</div>
              <p className={styles.msgFoot}>
                {m.status === "sent" && m.sentAt ? `Gönderildi: ${when(m.sentAt)}` : `Gönderim zamanı: ${when(m.sendAt)}`}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
