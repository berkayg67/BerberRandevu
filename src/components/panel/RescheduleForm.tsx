"use client";

import { useEffect, useState, useTransition } from "react";
import { panelSlotsAction, rescheduleAction } from "@/app/panel/actions";
import { dayLabel } from "@/components/booking/format";
import type { DayAppointment, PanelShop } from "@/server/panel/service";
import styles from "./panel.module.css";

/** Randevuyu başka güne, saate, ustaya ya da hizmete taşır. Müşteriye "güncellendi" mesajı gider. */
export function RescheduleForm({
  appointment: a,
  shop,
  currentDate,
  onDone,
  onBack,
}: {
  appointment: DayAppointment;
  shop: PanelShop;
  currentDate: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const services = shop.services.filter((s) => s.active || s.id === a.serviceId);
  const staff = shop.staff.filter((s) => s.active || s.id === a.staffId);
  const [serviceId, setServiceId] = useState(a.serviceId);
  const [staffId, setStaffId] = useState(a.staffId);
  const [date, setDate] = useState(currentDate < shop.today ? shop.today : currentDate);
  const [time, setTime] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; list: string[]; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = `${serviceId}|${staffId}|${date}`;

  useEffect(() => {
    let alive = true;
    panelSlotsAction({ serviceId, staffId, date, excludeAppointmentId: a.id }).then((r) => {
      if (alive) setResult({ key, list: r.times, error: r.error });
    });
    return () => {
      alive = false;
    };
  }, [key, serviceId, staffId, date, a.id]);

  const times = result?.key === key ? result : null;

  return (
    <>
      <h2 className={styles.sheetTitle}>Randevuyu ertele</h2>
      <p className={styles.sheetSub}>
        {a.customerName}, şu an {dayLabel(currentDate, shop.today, shop.timezone)} {a.time}
      </p>
      <div className="field">
        <label htmlFor="rs-date">Yeni gün</label>
        <input
          id="rs-date"
          type="date"
          className="input"
          min={shop.today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setTime(null);
          }}
        />
      </div>
      <div className={styles.row2}>
        <div className="field">
          <label htmlFor="rs-staff">Usta</label>
          <select
            id="rs-staff"
            className="select"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setTime(null);
            }}
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rs-svc">Hizmet</label>
          <select
            id="rs-svc"
            className="select"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setTime(null);
            }}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div aria-live="polite" style={{ minHeight: 56 }}>
        {!times ? (
          <p className={styles.sub}>Saatler yükleniyor…</p>
        ) : times.error ? (
          <p className="form-error">{times.error}</p>
        ) : times.list.length === 0 ? (
          <div className="empty">Bu gün için boş saat yok.</div>
        ) : (
          <div className={styles.slotGrid}>
            {times.list.map((t) => (
              <button key={t} type="button" className="slot" aria-pressed={time === t} onClick={() => setTime(t)}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="form-error" role="alert">
        {error}
      </p>
      <div className={styles.row2} style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-quiet" onClick={onBack}>
          Vazgeç
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!time || pending}
          onClick={() =>
            start(async () => {
              const r = await rescheduleAction({
                appointmentId: a.id,
                date,
                time: time!,
                staffId,
                serviceId: serviceId !== a.serviceId ? serviceId : undefined,
              });
              if (r.error) setError(r.error);
              else onDone();
            })
          }
        >
          {pending ? "Taşınıyor…" : "Taşı"}
        </button>
      </div>
    </>
  );
}
