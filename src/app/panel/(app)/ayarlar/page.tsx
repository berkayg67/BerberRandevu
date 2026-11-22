import type { Metadata } from "next";
import { Suspense } from "react";
import {
  saveContactAction,
  saveHoursAction,
  saveRulesAction,
  saveServiceAction,
  saveStaffAction,
} from "@/app/panel/actions";
import styles from "@/components/panel/panel.module.css";
import { SaveForm } from "@/components/panel/SaveForm";
import { formatPhone } from "@/lib/domain/phone";
import { requireOwner } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { getSettings, RULE_OPTIONS } from "@/server/panel/settings";

export const metadata: Metadata = { title: "Ayarlar", robots: { index: false } };

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIMES = Array.from({ length: 76 }, (_, i) => {
  const m = 5 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
const dur = (m: number) => (m === 0 ? "Yok" : m < 60 ? `${m} dk` : m % 60 === 0 ? `${m / 60} saat` : `${Math.floor(m / 60)} sa ${m % 60} dk`);
const lira = (k: number) => (k / 100).toLocaleString("tr-TR");

function TimeSelect({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <select name={name} className="select" defaultValue={value} aria-label={label}>
      {TIMES.map((t) => (
        <option key={t}>{t}</option>
      ))}
    </select>
  );
}

function Select({ name, value, options, format }: { name: string; value: number; options: readonly number[]; format: (v: number) => string }) {
  return (
    <select name={name} className="select" defaultValue={value}>
      {options.map((o) => (
        <option key={o} value={o}>
          {format(o)}
        </option>
      ))}
    </select>
  );
}

export default function SettingsPage() {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p className={styles.sub}>Yükleniyor…</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const { shopId } = await requireOwner();
  const s = await getSettings(getDb(), shopId);

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Ayarlar</h1>
          <p className={styles.sub}>Değişiklikler yeni randevular için geçerlidir; alınmış randevular olduğu gibi kalır.</p>
        </div>
      </div>

      <h2 className={styles.h2}>Çalışma saatleri</h2>
      <SaveForm action={saveHoursAction} className={styles.card}>
        {ORDER.map((d) => {
          const h = s.week[d].hours;
          return (
            <div key={d} className={styles.setRow}>
              <label>
                <input type="checkbox" name={`open-${d}`} className={styles.check} defaultChecked={!!h} />
                {DAYS[d]}
              </label>
              <span className={styles.times}>
                <TimeSelect name={`opens-${d}`} value={h?.opens ?? "09:00"} label={`${DAYS[d]} açılış`} />–
                <TimeSelect name={`closes-${d}`} value={h?.closes ?? "21:00"} label={`${DAYS[d]} kapanış`} />
              </span>
            </div>
          );
        })}
        <div className={styles.setRow}>
          <label>
            <input type="checkbox" name="lunch" className={styles.check} defaultChecked={!!s.lunch} />
            <span className={styles.lb}>
              Öğle arası<small>Bu saatlerde randevu verilmez</small>
            </span>
          </label>
          <span className={styles.times}>
            <TimeSelect name="lunchStart" value={s.lunch?.start ?? "13:00"} label="Öğle arası başlangıç" />–
            <TimeSelect name="lunchEnd" value={s.lunch?.end ?? "14:00"} label="Öğle arası bitiş" />
          </span>
        </div>
      </SaveForm>

      <h2 className={styles.h2}>Randevu kuralları</h2>
      <SaveForm action={saveRulesAction} className={styles.card}>
        <div className={styles.setRow}>
          <span className={styles.lb}>
            Randevular arası boşluk<small>Temizlik ve hazırlık için</small>
          </span>
          <Select name="bufferMinutes" value={s.rules.bufferMinutes} options={RULE_OPTIONS.bufferMinutes} format={dur} />
        </div>
        <div className={styles.setRow}>
          <span className={styles.lb}>
            Saat aralığı<small>Müşteriye kaç dakikada bir saat gösterilsin</small>
          </span>
          <Select name="slotMinutes" value={s.rules.slotMinutes} options={RULE_OPTIONS.slotMinutes} format={(v) => `${v} dk`} />
        </div>
        <div className={styles.setRow}>
          <span className={styles.lb}>
            En geç ne zaman<small>Randevu saatinden en az bu kadar önce</small>
          </span>
          <Select
            name="minNoticeMinutes"
            value={s.rules.minNoticeMinutes}
            options={RULE_OPTIONS.minNoticeMinutes}
            format={(v) => (v === 0 ? "Son dakikaya kadar" : v === 1440 ? "1 gün önce" : `${dur(v)} önce`)}
          />
        </div>
        <div className={styles.setRow}>
          <span className={styles.lb}>Kaç gün sonrasına kadar</span>
          <Select name="bookAheadDays" value={s.rules.bookAheadDays} options={RULE_OPTIONS.bookAheadDays} format={(v) => `${v} gün`} />
        </div>
        <div className={styles.setRow}>
          <span className={styles.lb}>
            Hatırlatma mesajı<small>Randevudan ne kadar önce</small>
          </span>
          <Select
            name="reminderMinutesBefore"
            value={s.rules.reminderMinutesBefore}
            options={RULE_OPTIONS.reminderMinutesBefore}
            format={(v) => (v === 1440 ? "1 gün" : dur(v))}
          />
        </div>
        <div className={styles.setRow}>
          <span className={styles.lb}>
            Teşekkür ve yorum isteği<small>Randevu bittikten ne kadar sonra</small>
          </span>
          <Select
            name="thanksMinutesAfter"
            value={s.rules.thanksMinutesAfter}
            options={RULE_OPTIONS.thanksMinutesAfter}
            format={(v) => (v === 0 ? "Hemen" : dur(v))}
          />
        </div>
      </SaveForm>

      <h2 className={styles.h2}>Hizmetler ve fiyatlar</h2>
      <div className={styles.card}>
        {s.services.map((svc) => (
          <SaveForm key={svc.id} action={saveServiceAction.bind(null, svc.id)} className={styles.svcGrid} compact>
            <input name="name" className="input" defaultValue={svc.name} aria-label="Hizmet adı" />
            <span className={styles.unit}>
              <input name="duration" className="input" inputMode="numeric" defaultValue={svc.durationMinutes} aria-label={`${svc.name} süresi`} />
              <em>dk</em>
            </span>
            <span className={styles.unit}>
              <input name="price" className="input" inputMode="decimal" defaultValue={lira(svc.priceKurus)} aria-label={`${svc.name} fiyatı`} />
              <em>₺</em>
            </span>
            <label className={styles.svcFoot} style={{ justifyContent: "flex-start", gap: 8, fontSize: 14 }}>
              <input type="checkbox" name="active" className={styles.check} defaultChecked={svc.active} />
              Müşterilere göster
            </label>
          </SaveForm>
        ))}
        <SaveForm action={saveServiceAction.bind(null, null)} className={styles.svcGrid} submitLabel="Hizmet ekle" compact>
          <input name="name" className="input" placeholder="Yeni hizmet" aria-label="Yeni hizmet adı" />
          <span className={styles.unit}>
            <input name="duration" className="input" inputMode="numeric" defaultValue={30} aria-label="Süre" />
            <em>dk</em>
          </span>
          <span className={styles.unit}>
            <input name="price" className="input" inputMode="decimal" placeholder="0" aria-label="Fiyat" />
            <em>₺</em>
          </span>
        </SaveForm>
      </div>

      <h2 className={styles.h2}>Ustalar</h2>
      <div className={styles.card}>
        {s.staff.map((st) => (
          <SaveForm key={st.id} action={saveStaffAction.bind(null, st.id)} className={styles.svcGrid} compact>
            <input name="name" className="input" defaultValue={st.name} aria-label="Usta adı" style={{ gridColumn: "span 2" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" name="active" className={styles.check} defaultChecked={st.active} />
              Çalışıyor
            </label>
          </SaveForm>
        ))}
        <SaveForm action={saveStaffAction.bind(null, null)} className={styles.svcGrid} submitLabel="Usta ekle" compact>
          <input name="name" className="input" placeholder="Yeni ustanın adı" aria-label="Yeni ustanın adı" style={{ gridColumn: "1 / -1" }} />
        </SaveForm>
      </div>

      <h2 className={styles.h2}>İletişim</h2>
      <SaveForm action={saveContactAction} className={styles.card}>
        <div style={{ paddingTop: 12 }}>
          <div className="field">
            <label htmlFor="c-phone">
              Dükkân telefonu <span className="hint">müşteriler görür</span>
            </label>
            <input id="c-phone" name="phone" className="input" inputMode="tel" defaultValue={s.contact.phone} />
          </div>
          <div className="field">
            <label htmlFor="c-address">Adres</label>
            <input id="c-address" name="address" className="input" defaultValue={s.contact.address} />
          </div>
          <div className="field">
            <label htmlFor="c-notify">
              Bildirim numarası <span className="hint">yeni randevular WhatsApp&apos;tan buraya gelir</span>
            </label>
            <input id="c-notify" name="notifyPhone" className="input" inputMode="tel" defaultValue={formatPhone(s.contact.notifyPhone)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="c-review">
              Google yorum linki <span className="hint">teşekkür mesajına eklenir</span>
            </label>
            <input id="c-review" name="reviewUrl" className="input" inputMode="url" placeholder="https://g.page/r/.../review" defaultValue={s.contact.reviewUrl} />
          </div>
        </div>
      </SaveForm>
    </>
  );
}
