import type { Metadata } from "next";
import { Plate } from "@/components/ui/Plate";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Tasarım sistemi, BerberRandevu",
  robots: { index: false },
};

const swatches = [
  ["--tile", "Zemin (fayans)"],
  ["--paper", "Kart"],
  ["--line", "Çizgi"],
  ["--ink", "Metin"],
  ["--muted", "İkincil metin"],
  ["--enamel", "Emaye mavi"],
  ["--enamel-tint", "Seçili zemin"],
  ["--kolonya", "Kolonya sarısı"],
  ["--oxblood", "Uyarı / iptal"],
  ["--ok", "Onay"],
  ["--wa", "WhatsApp balonu"],
] as const;

/**
 * Geliştirme sırasında bileşenleri iki temada birlikte görmek için.
 * Müşterilere bağlantı verilmez.
 */
export default function DesignSystemPage() {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.h1}>Tasarım sistemi</h1>
        <ThemeToggle />
      </div>

      <section className={styles.section}>
        <h2 className={styles.h2}>Tabela</h2>
        <div className={styles.inline}>
          <Plate district="Üsküdar" name="Berber Demo" />
          <Plate district="Üsküdar" name="Berber Demo" size="sm" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Renkler</h2>
        <div className={styles.swatches}>
          {swatches.map(([token, label]) => (
            <div key={token} className={styles.swatch}>
              <span style={{ background: `var(${token})` }} />
              <b>{label}</b>
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Yazı</h2>
        <p className={styles.display}>Ne yaptıracaksınız?</p>
        <p>
          Gövde metni Figtree ile, başlıklar ve saatler Barlow Condensed ile
          yazılır. Türkçe karakterler: ğüşıöç ĞÜŞİÖÇ.
        </p>
        <p className="num" style={{ fontSize: 28, fontWeight: 600 }}>
          09:30 10:15 700 ₺
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Düğmeler</h2>
        <div className={styles.inline}>
          <button className="btn btn-primary">Randevuyu onayla</button>
          <button className="btn btn-quiet">Tamam</button>
          <button className="btn btn-danger">İptal et</button>
          <button className="btn btn-primary" disabled>
            Devam et
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Liste</h2>
        <div className="group">
          <button className="row" aria-pressed="true">
            <span style={{ flex: 1 }}>Saç kesimi</span>
            <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
              500 ₺
            </span>
          </button>
          <button className="row" aria-pressed="false">
            <span style={{ flex: 1 }}>Sakal tıraşı</span>
            <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
              250 ₺
            </span>
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Seçimler</h2>
        <div className={styles.inline}>
          <button className="chip" aria-pressed="true">
            Fark etmez
          </button>
          <button className="chip" aria-pressed="false">
            Murat
          </button>
        </div>
        <div className={styles.slots}>
          <button className="slot" disabled>
            09:00
          </button>
          <button className="slot" aria-pressed="true">
            09:15
          </button>
          <button className="slot">09:30</button>
          <button className="slot">09:45</button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Form</h2>
        <div className="field">
          <label htmlFor="ornek-ad">Adınız ve soyadınız</label>
          <input id="ornek-ad" className="input" placeholder="Ahmet Yılmaz" />
        </div>
        <div className="field">
          <label htmlFor="ornek-tel">
            Cep telefonunuz <span className="hint">WhatsApp numaranız</span>
          </label>
          <input
            id="ornek-tel"
            className="input"
            aria-invalid="true"
            defaultValue="0532"
          />
        </div>
        <p className="form-error">Cep telefonu 05 ile başlamalı ve 11 haneli olmalı.</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Etiketler ve kutular</h2>
        <div className={styles.inline}>
          <span className="tag tag-green">Gitti</span>
          <span className="tag tag-yellow">Gidecek</span>
          <span className="tag tag-red">İptal</span>
          <span className="tag tag-grey">Tamamlandı</span>
        </div>
        <div className="empty" style={{ marginTop: 12 }}>
          Bu gün için boş saat kalmadı.
        </div>
        <div className="callout" style={{ marginTop: 12 }}>
          Değişiklikler yeni randevular için geçerli olur.
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>WhatsApp mesajı</h2>
        <div className="wa-preview">
          <div className="bubble">
            Merhaba Ahmet, randevunuz oluşturuldu.{"\n\n"}20 Kasım Cuma, saat
            10:15{"\n"}Saç ve sakal, usta Murat
            <time>10:02</time>
          </div>
        </div>
      </section>
    </div>
  );
}
