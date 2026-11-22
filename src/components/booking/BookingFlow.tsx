"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/domain/money";
import { normalizePhone } from "@/lib/domain/phone";
import type { PublicShop } from "@/server/shops/service";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/shop/Avatar";
import { api, ApiError, loadCustomer, saveCustomer, type Appointment, type Slot } from "./api";
import styles from "./booking.module.css";
import { bookableDays, dayLabel, DAYS_SHORT, groupSlots, MONTHS_SHORT } from "./format";
import { CheckIcon, DoneIcon, WhatsAppIcon } from "./icons";

/** Son getirilen saatler ve hangi seçim için getirildikleri. */
type SlotsResult = { key: string; slots: Slot[]; error?: string };
type Step = "usta" | "hizmet" | "zaman" | "bilgi";

const STEP_TITLE: Record<Step, string> = {
  usta: "Usta seçin",
  hizmet: "Ne yaptıracaksınız?",
  zaman: "Gün ve saat",
  bilgi: "Bilgileriniz",
};

/** "Hemen randevu al" düğmesi ve dört adımlı randevu penceresi: Usta, Hizmet, Tarih ve saat, Bilgiler. */
export function BookingFlow({ shop }: { shop: PublicShop }) {
  const closed = new Set(shop.closedDates);
  const openWeekdays = new Set(shop.hours.map((h) => h.weekday));
  const days = bookableDays(shop.today, shop.lastBookableDay, openWeekdays).map((d) => ({
    ...d,
    onHoliday: closed.has(d.date),
    open: d.open && !closed.has(d.date),
  }));
  const steps: Step[] = shop.staff.length > 1 ? ["usta", "hizmet", "zaman", "bilgi"] : ["hizmet", "zaman", "bilgi"];

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(() => days.find((d) => d.open)?.date ?? shop.today);
  const [time, setTime] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null);
  const requestKey = `${serviceId}|${staffId}|${date}|${refreshKey}`;
  const slots = {
    status: !serviceId ? "idle" : !slotsResult || slotsResult.key !== requestKey ? "loading" : slotsResult.error ? "error" : "ready",
    slots: slotsResult?.slots ?? [],
    error: slotsResult?.error,
  } as const;

  const [slotLost, setSlotLost] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  /** İsteğe bağlı açık rıza: randevu sonrası teşekkür ve yorum isteği mesajı. */
  const [thanksConsent, setThanksConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ appointment: Appointment; preview: string | null } | null>(null);
  const [cancelState, setCancelState] = useState<"idle" | "armed" | "busy" | "done">("idle");
  const [ctaVisible, setCtaVisible] = useState(true);
  const daysStrip = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLButtonElement>(null);

  const service = shop.services.find((s) => s.id === serviceId) ?? null;
  const staffName = staffId === "any" ? "İlk müsait usta" : (shop.staff.find((s) => s.id === staffId)?.name ?? "");
  const step = steps[stepIndex];

  // Büyük düğme ekrandan çıkınca altta küçük bir çubuk belirir.
  useEffect(() => {
    const el = cta.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Seçilen günü şeridin ortasına getir (sayfayı dikey kaydırmadan).
  useEffect(() => {
    const strip = daysStrip.current;
    const sel = strip?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (strip && sel) strip.scrollLeft = sel.offsetLeft - strip.clientWidth / 2 + sel.offsetWidth / 2;
  }, [date, step, open]);

  // Hizmet, usta ya da gün değişince boş saatleri getir.
  useEffect(() => {
    if (!serviceId || !open) return;
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
  }, [shop.slug, serviceId, staffId, date, requestKey, open]);

  const nextOpenDay = days.find((d) => d.open && d.date > date)?.date;

  function openWizard() {
    setFormError(null);
    setSlotLost(false);
    setDone(false);
    setStepIndex(0);
    if (!customer.name && !customer.phone) setCustomer(loadCustomer());
    setOpen(true);
  }

  const canContinue = step === "hizmet" ? !!service : step === "zaman" ? !!time : true;

  function next() {
    if (!canContinue) return;
    setFormError(null);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !time || slotLost) return;
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
        time,
        name,
        phone: customer.phone,
        consent: thanksConsent,
      });
      saveCustomer({ name, phone: customer.phone });
      setResult({ appointment: r.appointment, preview: r.whatsappPreview });
      setCancelState("idle");
      setDone(true);
      setTime(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const ae = err as ApiError;
      setFormError(ae.message);
      if (ae.code === "SLOT_TAKEN" || ae.code === "SLOT_UNAVAILABLE") {
        setSlotLost(true);
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

  const close = () => setOpen(false);

  return (
    <>
      <section className={styles.ctaCard} aria-label="Randevu">
        <div>
          <p className={styles.ctaTitle}>Sıra beklemeyin</p>
          <p className={styles.ctaSub}>Ustanızı, hizmeti ve saati seçin; onay WhatsApp&apos;ınıza gelsin.</p>
        </div>
        <button ref={cta} type="button" className={`btn btn-primary btn-block ${styles.ctaBtn}`} onClick={openWizard}>
          Hemen randevu al
        </button>
      </section>

      {!ctaVisible && !open && (
        <div className={`${styles.bar} material`}>
          <div className={styles.barIn}>
            <div className={styles.sum}>
              <b>{shop.name}</b>
              <span>Online randevu</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={openWizard}>
              Randevu al
            </button>
          </div>
        </div>
      )}

      <Sheet open={open} onClose={close} label="Randevu al">
        {!done && (
          <div className={styles.wiz}>
            <div className={styles.wizHead}>
              <button
                type="button"
                className={styles.back}
                onClick={() => (stepIndex === 0 ? close() : setStepIndex(stepIndex - 1))}
                aria-label={stepIndex === 0 ? "Kapat" : "Önceki adım"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={stepIndex === 0 ? "M6 6l12 12M18 6L6 18" : "M15 5l-7 7 7 7"} />
                </svg>
              </button>
              <ol className={styles.dots} aria-label={`Adım ${stepIndex + 1} / ${steps.length}`}>
                {steps.map((s, i) => (
                  <li key={s} data-state={i < stepIndex ? "done" : i === stepIndex ? "now" : "todo"} />
                ))}
              </ol>
              <span className={styles.stepNo}>
                {stepIndex + 1}/{steps.length}
              </span>
            </div>
            <h2 className={styles.sheetTitle}>{STEP_TITLE[step]}</h2>

            {step === "usta" && (
              <div className="group">
                <button type="button" className="row" aria-pressed={staffId === "any"} onClick={() => setStaffId("any")}>
                  <span className={styles.anyFace} aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="9" r="3" />
                      <circle cx="17" cy="10" r="2.4" />
                      <path d="M3 19c.6-3 2.8-4.5 6-4.5s5.4 1.5 6 4.5M15 15c3 0 5 1.3 6 4" />
                    </svg>
                  </span>
                  <span className={styles.svcMain}>
                    <span className={styles.svcName}>Fark etmez</span>
                    <span className={styles.svcDur}>İlk müsait usta</span>
                  </span>
                  <span className={styles.tick}>
                    <CheckIcon />
                  </span>
                </button>
                {shop.staff.map((s) => (
                  <button key={s.id} type="button" className="row" aria-pressed={staffId === s.id} onClick={() => setStaffId(s.id)}>
                    <Avatar name={s.name} photoId={s.photoId} size={44} />
                    <span className={styles.svcMain}>
                      <span className={styles.svcName}>{s.name}</span>
                    </span>
                    <span className={styles.tick}>
                      <CheckIcon />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {step === "hizmet" && (
              <div className="group">
                {shop.services.map((s) => (
                  <button key={s.id} type="button" className="row" aria-pressed={serviceId === s.id} onClick={() => setServiceId(s.id)}>
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
            )}

            {step === "zaman" && (
              <>
                <div className={styles.strip} ref={daysStrip}>
                  {days.map((d, i) => (
                    <button
                      key={d.date}
                      type="button"
                      className={`${styles.day} ${i === 0 ? styles.today : ""}`}
                      aria-pressed={date === d.date}
                      disabled={!d.open}
                      aria-label={`${dayLabel(d.date, shop.today, shop.timezone)}${d.onHoliday ? ", tatil" : d.open ? "" : ", kapalı"}`}
                      onClick={() => {
                        setDate(d.date);
                        setTime(null);
                      }}
                    >
                      <span className={styles.dayW}>{i === 0 ? "Bugün" : i === 1 ? "Yarın" : DAYS_SHORT[d.weekday]}</span>
                      <span className={styles.dayD}>{d.day}</span>
                      <span className={styles.dayM}>{d.onHoliday ? "Tatil" : d.open ? MONTHS_SHORT[d.month] : "Kapalı"}</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 16 }} aria-live="polite">
                  {slots.status === "error" ? (
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
              </>
            )}

            {step === "bilgi" && service && time && (
              <form id="booking-form" onSubmit={submit} noValidate>
                <dl className={styles.facts}>
                  <div>
                    <dt>Gün</dt>
                    <dd>{dayLabel(date, shop.today, shop.timezone)}</dd>
                  </div>
                  <div>
                    <dt>Saat</dt>
                    <dd style={slotLost ? { textDecoration: "line-through", color: "var(--faint)" } : undefined}>{time}</dd>
                  </div>
                  <div>
                    <dt>Hizmet</dt>
                    <dd>
                      {service.name}, {service.durationMinutes} dk
                    </dd>
                  </div>
                  <div>
                    <dt>Usta</dt>
                    <dd>{staffName}</dd>
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
              </form>
            )}

            <div className={styles.wizFoot}>
              {step !== "bilgi" ? (
                <>
                  {service && (
                    <p className={styles.footSum}>
                      <b>{service.name}</b>
                      <span>{formatPrice(service.priceKurus)}</span>
                    </p>
                  )}
                  <button type="button" className="btn btn-primary btn-block" disabled={!canContinue} onClick={next}>
                    Devam et
                  </button>
                </>
              ) : slotLost ? (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    setSlotLost(false);
                    setFormError(null);
                    setStepIndex(steps.indexOf("zaman"));
                  }}
                >
                  Başka saat seç
                </button>
              ) : (
                <button type="submit" form="booking-form" className="btn btn-primary btn-block" disabled={submitting}>
                  {submitting ? "Randevu alınıyor…" : "Randevuyu onayla"}
                </button>
              )}
            </div>
          </div>
        )}

        {done && result && cancelState !== "done" && (
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
              <button type="button" className="btn btn-quiet" onClick={close}>
                Tamam
              </button>
            </div>
          </>
        )}
        {done && result && cancelState === "done" && (
          <>
            <h2 className={styles.sheetTitle}>Randevunuz iptal edildi</h2>
            <p className={styles.sheetSub}>Dükkâna da haber verildi. Hatırlatma mesajı gönderilmeyecek.</p>
            <button type="button" className="btn btn-quiet btn-block" onClick={close}>
              Kapat
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
