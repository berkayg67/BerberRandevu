"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cancelByShopAction, saveAppointmentNoteAction, setNoShowAction } from "@/app/panel/actions";
import { Sheet } from "@/components/ui/Sheet";
import { formatPrice } from "@/lib/domain/money";
import { formatPhone, toWhatsAppNumber } from "@/lib/domain/phone";
import type { DayAppointment, PanelShop } from "@/server/panel/service";
import { RescheduleForm } from "./RescheduleForm";
import styles from "./panel.module.css";

function statusTag(a: DayAppointment) {
  if (a.status === "cancelled")
    return <span className="tag tag-red">{a.cancelledBy === "customer" ? "Müşteri iptal etti" : "İptal edildi"}</span>;
  if (a.noShow) return <span className="tag tag-yellow">Gelmedi</span>;
  if (a.past) return <span className="tag tag-grey">Tamamlandı</span>;
  if (a.started) return <span className="tag tag-green">Şu an</span>;
  return null;
}

/** Günün randevuları, saat sırasıyla. Dokununca ayrıntı ve işlemler açılır. */
export function DayList({ appointments, shop, date }: { appointments: DayAppointment[]; shop: PanelShop; date: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = appointments.find((a) => a.id === openId) ?? null;

  function show(id: string) {
    setOpenId(id);
    setMoving(false);
    setNote(appointments.find((a) => a.id === id)?.note ?? "");
    setNoteSaved(false);
    setArmed(false);
    setError(null);
  }

  function run(fn: () => Promise<{ error?: string }>, closeAfter: boolean) {
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else if (closeAfter) setOpenId(null);
    });
  }

  if (appointments.length === 0) {
    return <div className="empty">Bu gün için randevu yok. Telefonla gelen randevuları sağ alttaki düğmeyle ekleyebilirsiniz.</div>;
  }

  return (
    <>
      <div className="group">
        {appointments.map((a) => {
          const dim = a.status === "cancelled" || a.noShow;
          return (
            <button
              key={a.id}
              type="button"
              className={`${styles.item} ${dim ? styles.dim : ""} ${a.status === "cancelled" ? styles.struck : ""}`}
              onClick={() => show(a.id)}
            >
              <span className={styles.time}>
                {a.time}
                <small>{a.endTime}</small>
              </span>
              <span className={styles.who}>
                <b>{a.customerName}</b>
                <span>
                  {a.serviceName}, {a.staffName}
                  {a.source === "panel" ? ", dükkândan" : ""}
                </span>
              </span>
              {statusTag(a)}
            </button>
          );
        })}
      </div>

      <Sheet open={!!open} onClose={() => setOpenId(null)} label="Randevu ayrıntısı">
        {open && moving && (
          <RescheduleForm
            appointment={open}
            shop={shop}
            currentDate={date}
            onBack={() => setMoving(false)}
            onDone={() => {
              setMoving(false);
              setOpenId(null);
            }}
          />
        )}
        {open && !moving && (
          <>
            <h2 className={styles.sheetTitle}>{open.customerName}</h2>
            <p className={styles.sheetSub}>{formatPhone(open.customerPhone)}</p>
            <dl className={styles.facts}>
              <div>
                <dt>Saat</dt>
                <dd>
                  {open.time}–{open.endTime}
                </dd>
              </div>
              <div>
                <dt>Hizmet</dt>
                <dd>{open.serviceName}</dd>
              </div>
              <div>
                <dt>Usta</dt>
                <dd>{open.staffName}</dd>
              </div>
              <div>
                <dt>Ücret</dt>
                <dd>{formatPrice(open.priceKurus)}</dd>
              </div>
              <div>
                <dt>Nereden</dt>
                <dd>{open.source === "panel" ? "Dükkândan eklendi" : "Online randevu"}</dd>
              </div>
              <div>
                <dt>Durum</dt>
                <dd>{statusTag(open) ?? <span className="tag tag-green">Bekleniyor</span>}</dd>
              </div>
            </dl>

            <div className={styles.actions}>
              <div className={styles.row2}>
                <a className="btn btn-quiet" href={`tel:0${open.customerPhone}`}>
                  Ara
                </a>
                <a
                  className="btn btn-wa"
                  href={`https://wa.me/${toWhatsAppNumber(open.customerPhone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </div>

              {open.status === "active" && !open.past && (
                <button type="button" className="btn btn-quiet btn-block" onClick={() => setMoving(true)}>
                  Randevuyu ertele
                </button>
              )}

              {open.status === "active" && !open.started && (
                <button
                  type="button"
                  className={`btn btn-danger btn-block ${armed ? styles.armed : ""}`}
                  disabled={pending}
                  onClick={() => (armed ? run(() => cancelByShopAction(open.id), true) : setArmed(true))}
                >
                  {pending ? "İptal ediliyor…" : armed ? "Emin misiniz? Müşteriye haber verilecek" : "Randevuyu iptal et"}
                </button>
              )}

              {open.status === "active" && open.started && (
                <button
                  type="button"
                  className="btn btn-quiet btn-block"
                  disabled={pending}
                  onClick={() => run(() => setNoShowAction(open.id, !open.noShow), false)}
                >
                  {pending ? "Kaydediliyor…" : open.noShow ? "Geldi olarak işaretle" : "Gelmedi olarak işaretle"}
                </button>
              )}
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="ap-note">
                Not <span className="hint">yalnızca siz görürsünüz</span>
              </label>
              <textarea
                id="ap-note"
                className="input"
                rows={2}
                maxLength={300}
                value={note}
                placeholder="Örn. sakal şekli, özel istek"
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteSaved(false);
                }}
                onBlur={() => {
                  if (note.trim() !== (open.note ?? "")) {
                    start(async () => {
                      const r = await saveAppointmentNoteAction(open.id, note);
                      if (r.error) setError(r.error);
                      else setNoteSaved(true);
                    });
                  }
                }}
              />
              {noteSaved && <p className={styles.okInline}>Not kaydedildi.</p>}
            </div>
            {open.customerNote && (
              <p className={styles.sheetSub}>
                Müşteri notu: {open.customerNote}
              </p>
            )}
            <Link href={`/panel/musteriler/${open.customerId}`} className="btn btn-quiet btn-block" style={{ marginTop: 8 }}>
              Müşteri kartı
            </Link>
            {open.noShow && (
              <p className={styles.sheetSub} style={{ marginTop: 10 }}>
                Gelmedi olarak işaretlendiği için teşekkür mesajı gönderilmeyecek.
              </p>
            )}
            <p className="form-error" role="alert" style={{ marginTop: 8 }}>
              {error}
            </p>
          </>
        )}
      </Sheet>
    </>
  );
}
