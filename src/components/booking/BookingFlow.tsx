"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/domain/money";
import { normalizePhone } from "@/lib/domain/phone";
import type { PublicShop } from "@/server/shops/service";
import { Sheet } from "@/components/ui/Sheet";
import { api, ApiError, loadCustomer, saveCustomer, type Appointment, type Slot } from "./api";
import styles from "./booking.module.css";
import { bookableDays, dayLabel, DAYS_SHORT, groupSlots, MONTHS_SHORT } from "./format";
import { CheckIcon, DoneIcon, WhatsAppIcon } from "./icons";

/** Son getirilen saatler ve hangi seçim için getirildikleri. */
type SlotsResult = { key: string; slots: Slot[]; error?: string };

export function BookingFlow({ shop }: { shop: PublicShop }) {
  const openWeekdays = new Set(shop.hours.map((h) => h.weekday));
  const days = bookableDays(shop.today, shop.lastBookableDay, openWeekdays);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(() => days.find((d) => d.open)?.date ?? shop.today);
  const [time, setTime] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null);
  const requestKey = `${serviceId}|${staffId}|${date}|${refreshKey}`;
  // Seçim değiştiyse ve yeni saatler henüz gelmediyse "yükleniyor" sayılır.
  const slots = {
    status: !serviceId ? "idle" : !slotsResult || slotsResult.key !== requestKey ? "loading" : slotsResult.error ? "error" : "ready",
    slots: slotsResult?.slots ?? [],
    error: slotsResult?.error,
  } as const;

  const [sheet, setSheet] = useState<"details" | "done" | null>(null);
  /** Onay penceresi açıldığındaki saat; arka planda saat dolsa da pencere boşalmaz. */
  const [pendingTime, setPendingTime] = useState<string | null>(null);
  const [slotLost, setSlotLost] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  /** İsteğe bağlı açık rıza: randevu sonrası teşekkür ve yorum isteği mesajı. */
  const [thanksConsent, setThanksConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ appointment: Appointment; preview: string | null } | null>(null);
  const [cancelState, setCancelState] = useState<"idle" | "armed" | "busy" | "done">("idle");
  const daysStrip = useRef<HTMLDivElement>(null);

  const service = shop.services.find((s) => s.id === serviceId) ?? null;

  // Seçilen günü şeridin ortasına getir (sayfayı dikey kaydırmadan).
  useEffect(() => {
    const strip = daysStrip.current;
    const sel = strip?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (strip && sel) strip.scrollLeft = sel.offsetLeft - strip.clientWidth / 2 + sel.offsetWidth / 2;
  }, [date]);

  // Hizmet, usta ya da gün değişince boş saatleri getir.
  useEffect(() => {
    if (!serviceId) return;
    const ctrl = new AbortController();
    const key = requestKey;
    api
      .slots(shop.slug, { service: serviceId, date, staff: staffId }, ctrl.signal)
      .then((r) => {
        setSlotsResult({ key, slots: r.slots });
        setTime((t) => (t && r.slots.some((s) => s.time === t && s.available) ? t : null));
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setSlotsResult({ key, slots: [], error: (e as Error).message });
      });
    return () => ctrl.abort();
  }, [shop.slug, serviceId, staffId, date, requestKey]);

  const nextOpenDay = days.find((d) => d.open && d.date > date)?.date;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !pendingTime || slotLost) return;
    const name = customer.name.trim();
    if (name.length < 3) return setFormError("Adınızı ve soyadınızı yazın.");
    if (!normalizePhone(customer.phone)) return setFormError("Cep telefonu 05 ile başlamalı ve 11 haneli olmalı.");
    setSubmitting(true);
    setFormError(null);
    try {
      const r = await api.book(shop.slug, {
        serviceId: service.id,
        staffId,
        date,
        time: pendingTime,
        name,
        phone: customer.phone,
        consent: thanksConsent,
      });
      saveCustomer({ name, phone: customer.phone });
      setResult({ appointment: r.appointment, preview: r.whatsappPreview });
      setCancelState("idle");
      setSheet("done");
      setTime(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const ae = err as ApiError;
      setFormError(ae.message);
      if (ae.code === "SLOT_TAKEN" || ae.code === "SLOT_UNAVAILABLE") {
        setSlotLost(true);
        setTime(null);
        setRefreshKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooked() {
    if (!result) return;
    if (cancelState === "idle") return setCancelState("armed");
    setCancelState("busy");
    try {
      await api.cancel(shop.slug, result.appointment.id, customer.phone);
      setCancelState("done");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setFormError((err as Error).message);
      setCancelState("idle");
    }
  }

  const closeSheet = () => setSheet(null);

  return (
    <>
      <section className={styles.section} aria-labelledby="h-svc">
        <h2 id="h-svc" className={styles.h2}>
          Ne yaptıracaksınız?
        </h2>
        <div className="group">
          {shop.services.map((s) => (
            <button
              key={s.id}
              type="button"
              className="row"
              aria-pressed={serviceId === s.id}
              onClick={() => setServiceId(s.id)}
            >
              <span className={styles.tick}>
                <CheckIcon />
              </span>
              <span className={styles.svcMain}>
                <span className={styles.svcName}>{s.name}</span>
                <span className={styles.svcDur}>{s.durationMinutes} dk</span>
              </span>
              <span className={styles.price}>{formatPrice(s.priceKurus)}</span>
            </button>
          ))}
        </div>
      </section>

      {shop.staff.length > 1 && (
        <section className={styles.section} aria-labelledby="h-staff">
          <h2 id="h-staff" className={styles.h2}>
            Usta
          </h2>
          <div className={styles.strip}>
            <button type="button" className="chip" aria-pressed={staffId === "any"} onClick={() => setStaffId("any")}>
              Fark etmez
            </button>
            {shop.staff.map((s) => (
              <button key={s.id} type="button" className="chip" aria-pressed={staffId === s.id} onClick={() => setStaffId(s.id)}>
                <span className={styles.av} aria-hidden="true">
                  {s.name.charAt(0).toLocaleUpperCase("tr-TR")}
                </span>
                {s.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="h-day">
        <h2 id="h-day" className={styles.h2}>
          Gün ve saat
        </h2>
        <div className={styles.strip} ref={daysStrip}>
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              className={`${styles.day} ${i === 0 ? styles.today : ""}`}
              aria-pressed={date === d.date}
              disabled={!d.open}
              aria-label={`${dayLabel(d.date, shop.today, shop.timezone)}${d.open ? "" : ", kapalı"}`}
              onClick={() => {
                setDate(d.date);
                setTime(null);
              }}
            >
              <span className={styles.dayW}>{i === 0 ? "Bugün" : i === 1 ? "Yarın" : DAYS_SHORT[d.weekday]}</span>
              <span className={styles.dayD}>{d.day}</span>
              <span className={styles.dayM}>{d.open ? MONTHS_SHORT[d.month] : "Kapalı"}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }} aria-live="polite">
          {!serviceId ? (
            <div className="empty">Boş saatleri görmek için önce bir hizmet seçin.</div>
          ) : slots.status === "error" ? (
            <div className="empty">
              {slots.error}{" "}
              <button type="button" className={styles.textlink} onClick={() => setRefreshKey((k) => k + 1)}>
                Tekrar dene
              </button>
            </div>
          ) : slots.status === "loading" && slots.slots.length === 0 ? (
            <div className={styles.slots} aria-label="Saatler yükleniyor">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={styles.skeleton} />
              ))}
            </div>
          ) : !slots.slots.some((s) => s.available) ? (
            <div className="empty">
              {dayLabel(date, shop.today, shop.timezone)} için boş saat kalmadı.
              {nextOpenDay && (
                <>
                  {" "}
                  <button
                    type="button"
                    className={styles.textlink}
                    onClick={() => {
                      setDate(nextOpenDay);
                      setTime(null);
                    }}
                  >
                    {dayLabel(nextOpenDay, shop.today, shop.timezone)} için bakın
                  </button>
                </>
              )}
            </div>
          ) : (
            groupSlots(slots.slots).map((g) => (
              <div key={g.title} className={styles.slotGroup}>
                <h3>{g.title}</h3>
                <div className={styles.slots}>
                  {g.slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      className="slot"
                      aria-pressed={time === s.time}
                      disabled={!s.available}
                      aria-label={`${s.time}${s.available ? "" : ", dolu"}`}
                      onClick={() => setTime(s.time)}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className={`${styles.bar} material`}>
        <div className={styles.barIn}>
          <div className={styles.sum}>
            {service ? (
              <>
                <b>
                  {service.name}, {formatPrice(service.priceKurus)}
                </b>
                <span>
                  {dayLabel(date, shop.today, shop.timezone)}
                  {time ? `, ${time}` : ", saat seçin"}
                </span>
              </>
            ) : (
              <>
                <b>Randevu alın</b>
                <span>Hizmet seçerek başlayın</span>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!service || !time}
            onClick={() => {
              setFormError(null);
              setSlotLost(false);
              setPendingTime(time);
              // Önceki randevudan hatırlanan ad ve telefon (bu cihazda).
              if (!customer.name && !customer.phone) setCustomer(loadCustomer());
              setSheet("details");
            }}
          >
            Devam et
          </button>
        </div>
      </div>

      <Sheet open={sheet === "details"} onClose={closeSheet} label="Randevuyu onaylayın">
        {service && pendingTime && (
          <form onSubmit={submit} noValidate>
            <h2 className={styles.sheetTitle}>Randevuyu onaylayın</h2>
            <p className={styles.sheetSub}>Onay mesajı WhatsApp&apos;ınıza gelecek.</p>
            <dl className={styles.facts}>
              <div>
                <dt>Gün</dt>
                <dd>{dayLabel(date, shop.today, shop.timezone)}</dd>
              </div>
              <div>
                <dt>Saat</dt>
                <dd style={slotLost ? { textDecoration: "line-through", color: "var(--faint)" } : undefined}>{pendingTime}</dd>
              </div>
              <div>
                <dt>Hizmet</dt>
                <dd>
                  {service.name}, {service.durationMinutes} dk
                </dd>
              </div>
              <div>
                <dt>Usta</dt>
                <dd>{staffId === "any" ? "İlk müsait usta" : shop.staff.find((s) => s.id === staffId)?.name}</dd>
              </div>
              <div>
                <dt>Ücret</dt>
                <dd>{formatPrice(service.priceKurus)}</dd>
              </div>
            </dl>
            <div className="field">
              <label htmlFor="b-name">Adınız ve soyadınız</label>
              <input
                id="b-name"
                className="input"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                value={customer.name}
                onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="b-phone">
                Cep telefonunuz <span className="hint">WhatsApp kullandığınız numara</span>
              </label>
              <input
                id="b-phone"
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="done"
                placeholder="05XX XXX XX XX"
                value={customer.phone}
                onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
              />
            </div>
            <p className={styles.privacy}>
              Adınız ve telefonunuz randevunuzu oluşturmak ve size WhatsApp&apos;tan onay ile hatırlatma göndermek için{" "}
              {shop.name} ile paylaşılır. Ayrıntılar için{" "}
              <a href="/yasal/musteri-aydinlatma" target="_blank" rel="noopener">
                aydınlatma metnini
              </a>{" "}
              okuyabilirsiniz.
            </p>
            <label className={styles.consent}>
              <input type="checkbox" checked={thanksConsent} onChange={(e) => setThanksConsent(e.target.checked)} />
              <span>
                Randevumdan sonra teşekkür ve yorum isteği mesajı gönderilmesine{" "}
                <a href="/yasal/acik-riza" target="_blank" rel="noopener">
                  açık rıza
                </a>{" "}
                veriyorum. <em>İsteğe bağlı; vermezseniz randevunuz aynen alınır.</em>
              </span>
            </label>
            <p className="form-error" role="alert">
              {formError}
            </p>
            {slotLost ? (
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={closeSheet}>
                Başka saat seç
              </button>
            ) : (
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: 8 }}>
                {submitting ? "Randevu alınıyor…" : "Randevuyu onayla"}
              </button>
            )}
          </form>
        )}
      </Sheet>

      <Sheet open={sheet === "done"} onClose={closeSheet} label="Randevu sonucu">
        {result && cancelState !== "done" && (
          <>
            <div className={styles.doneMark}>
              <DoneIcon />
            </div>
            <h2 className={styles.sheetTitle}>Randevunuz alındı</h2>
            <p className={styles.sheetSub}>
              {dayLabel(result.appointment.date, shop.today, shop.timezone)} saat {result.appointment.time}&apos;de sizi
              bekliyoruz. Usta: {result.appointment.staffName}.
            </p>
            {result.preview && (
              <div className="wa-preview">
                <div className={styles.waHead}>
                  <WhatsAppIcon />
                  WhatsApp&apos;ınıza gelecek mesaj
                </div>
                <div className="bubble">{result.preview}</div>
              </div>
            )}
            <p className="form-error" role="alert">
              {formError}
            </p>
            <div className={styles.btnRow}>
              <button
                type="button"
                className={`btn btn-danger ${cancelState === "armed" ? styles.armed : ""}`}
                disabled={cancelState === "busy"}
                onClick={cancelBooked}
              >
                {cancelState === "armed" ? "Emin misiniz?" : cancelState === "busy" ? "İptal ediliyor…" : "İptal et"}
              </button>
              <button type="button" className="btn btn-quiet" onClick={closeSheet}>
                Tamam
              </button>
            </div>
          </>
        )}
        {result && cancelState === "done" && (
          <>
            <h2 className={styles.sheetTitle}>Randevunuz iptal edildi</h2>
            <p className={styles.sheetSub}>Dükkâna da haber verildi. Hatırlatma mesajı gönderilmeyecek.</p>
            <button type="button" className="btn btn-quiet btn-block" onClick={closeSheet}>
              Kapat
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
