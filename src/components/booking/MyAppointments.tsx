"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/domain/money";
import { normalizePhone } from "@/lib/domain/phone";
import type { PublicShop } from "@/server/shops/service";
import { api, loadCustomer, saveCustomer, type Appointment } from "./api";
import styles from "./booking.module.css";
import { dayLabel } from "./format";

/** "Randevularım": telefon numarasına ait aktif randevular ve iptal. */
export function MyAppointments({ shop }: { shop: PublicShop }) {
  // Bu bileşen yalnızca tarayıcıda, sekme açılınca çizilir; kayıtlı numarayı hemen okuyabilir.
  const [initialPhone] = useState(() => loadCustomer().phone);
  const [phone, setPhone] = useState(initialPhone);
  const [list, setList] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Kayıtlı numara varsa randevuları kendiliğinden getir.
  useEffect(() => {
    if (!normalizePhone(initialPhone)) return;
    const ctrl = { cancelled: false };
    api
      .lookup(shop.slug, initialPhone)
      .then((r) => !ctrl.cancelled && setList(r.appointments))
      .catch(() => {});
    return () => {
      ctrl.cancelled = true;
    };
  }, [shop.slug, initialPhone]);

  async function find(value = phone) {
    setNotice(null);
    setArmed(null);
    if (!normalizePhone(value)) {
      setError("Numarayı 05XX XXX XX XX biçiminde yazın.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await api.lookup(shop.slug, value);
      setList(r.appointments);
      const saved = loadCustomer();
      saveCustomer({ name: saved.name, phone: value });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function cancel(a: Appointment) {
    if (armed !== a.id) return setArmed(a.id);
    setBusy(a.id);
    try {
      await api.cancel(shop.slug, a.id, phone);
      setList((l) => l?.filter((x) => x.id !== a.id) ?? null);
      setNotice(`${dayLabel(a.date, shop.today, shop.timezone)} ${a.time} randevunuz iptal edildi. Dükkâna da haber verildi.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      setArmed(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="h-mine">
      <h2 id="h-mine" className={styles.h2}>
        Randevularım
      </h2>
      <p className={styles.lead}>Randevu alırken yazdığınız telefon numarasıyla aktif randevularınızı görün.</p>
      <form
        className={styles.lookup}
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
        noValidate
      >
        <input
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="search"
          placeholder="05XX XXX XX XX"
          aria-label="Cep telefonu"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Aranıyor…" : "Göster"}
        </button>
      </form>
      <p className="form-error" role="alert" style={{ marginTop: 8 }}>
        {error}
      </p>

      {notice && <p className={styles.notice}>{notice}</p>}

      {list && list.length === 0 && !notice && (
        <div className="empty" style={{ marginTop: 8 }}>
          Bu numaraya ait aktif randevu yok.
        </div>
      )}

      {list && list.length > 0 && (
        <div className="group" style={{ marginTop: 8 }}>
          {list.map((a) => (
            <div key={a.id} className={styles.apptRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.apptWhen}>
                  {dayLabel(a.date, shop.today, shop.timezone)}, {a.time}–{a.endTime}
                </div>
                <div className={styles.apptMeta}>
                  {a.serviceName}, usta {a.staffName}, {formatPrice(a.priceKurus)}
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-danger ${armed === a.id ? styles.armed : ""}`}
                style={{ minHeight: 40, padding: "0 14px" }}
                disabled={busy === a.id}
                onClick={() => cancel(a)}
              >
                {busy === a.id ? "İptal…" : armed === a.id ? "Emin misiniz?" : "İptal et"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
