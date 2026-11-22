"use client";

import { useActionState, useEffect, useState } from "react";
import { addAppointmentAction, panelSlotsAction, type PanelFormState } from "@/app/panel/actions";
import { dayLabel } from "@/components/booking/format";
import { Sheet } from "@/components/ui/Sheet";
import { formatPrice } from "@/lib/domain/money";
import { addDays } from "@/lib/domain/time";
import type { PanelShop } from "@/server/panel/service";
import { PlusIcon } from "./icons";
import styles from "./panel.module.css";

/** Telefonla ya da dükkânda alınan randevuyu eklemek için. */
export function AddAppointment({ shop, defaultDate }: { shop: PanelShop; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  // Her açılışta form sıfırdan başlar (önceki sonuç ve hata görünmez).
  const [formKey, setFormKey] = useState(0);

  function openSheet() {
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <>
      <button type="button" className={`btn btn-primary ${styles.addBtn}`} onClick={openSheet}>
        <PlusIcon />
        Randevu ekle
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Randevu ekle">
        <h2 className={styles.sheetTitle}>Randevu ekle</h2>
        <p className={styles.sheetSub}>Telefonla ya da dükkânda alınan randevular için. Müşteriye onay mesajı gider.</p>
        {open && (
          <AddForm key={formKey} shop={shop} defaultDate={defaultDate} onAnother={openSheet} onDone={() => setOpen(false)} />
        )}
      </Sheet>
    </>
  );
}

function AddForm({
  shop,
  defaultDate,
  onAnother,
  onDone,
}: {
  shop: PanelShop;
  defaultDate: string;
  onAnother: () => void;
  onDone: () => void;
}) {
  const services = shop.services.filter((s) => s.active);
  const staff = shop.staff.filter((s) => s.active);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(defaultDate);
  const [times, setTimes] = useState<{ key: string; list: string[]; error?: string } | null>(null);
  const [state, action, pending] = useActionState<PanelFormState, FormData>(addAppointmentAction, {});

  const key = `${serviceId}|${staffId}|${date}|${state.error ?? ""}`;
  const loading = !times || times.key !== key;

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    panelSlotsAction({ serviceId, staffId, date }).then((r) => {
      if (!cancelled) setTimes({ key, list: r.times, error: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId, staffId, date, key]);

  const days = Array.from({ length: shop.bookAheadDays + 7 }, (_, i) => addDays(shop.today, i));

  if (state.ok && !pending) {
    return (
      <>
        <p className={styles.okText}>{state.ok}</p>
        <div className={styles.row2} style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-quiet" onClick={onAnother}>
            Bir tane daha ekle
          </button>
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Tamam
          </button>
        </div>
      </>
    );
  }

  return (
    <form action={action} noValidate>
      <div className="field">
        <label htmlFor="p-name">Müşteri adı</label>
        <input id="p-name" name="name" className="input" autoComplete="off" defaultValue={state.values?.name ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="p-phone">Cep telefonu</label>
        <input
          id="p-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          className="input"
          placeholder="05XX XXX XX XX"
          defaultValue={state.values?.phone ?? ""}
        />
      </div>
      <div className="field">
        <label htmlFor="p-svc">Hizmet</label>
        <select id="p-svc" name="serviceId" className="select" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}, {s.durationMinutes} dk, {formatPrice(s.priceKurus)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.row2}>
        <div className="field">
          <label htmlFor="p-day">Gün</label>
          <select id="p-day" name="date" className="select" value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d, shop.today, shop.timezone)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="p-staff">Usta</label>
          <select id="p-staff" name="staffId" className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="any">Fark etmez</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="p-time">Saat</label>
        <select id="p-time" name="time" className="select" disabled={loading || !times?.list.length} defaultValue={state.values?.time}>
          {loading ? (
            <option>Saatler yükleniyor…</option>
          ) : times?.list.length ? (
            times.list.map((t) => <option key={t}>{t}</option>)
          ) : (
            <option value="">Bu gün boş saat yok</option>
          )}
        </select>
      </div>
      {state.needsConfirm && <input type="hidden" name="confirmBlocked" value="1" />}
      <p className="form-error" role="alert">
        {state.error ?? times?.error}
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending || loading || !times?.list.length}>
        {pending ? "Ekleniyor…" : state.needsConfirm ? "Yine de ekle" : "Randevuyu ekle"}
      </button>
    </form>
  );
}
