import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import styles from "@/components/home/home.module.css";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: { absolute: "Tıraş Vakti: berberler için online randevu" },
  description:
    "Müşteri boş saati görüp randevusunu kendisi alır, onay ve hatırlatma WhatsApp'tan gider. Berber günü tek ekrandan yönetir.",
};

const FOR_CUSTOMER = [
  "Hizmeti, ustayı ve boş saati seçip randevu alır",
  "Telefon numarasıyla randevularını görür, iptal eder",
  "Onay ve randevudan 1 saat önce hatırlatmayı WhatsApp'tan alır",
];

const FOR_BARBER = [
  "Günün randevularını tek listede görür",
  "Telefonla gelen randevuyu kendisi ekler",
  "Çalışma saatlerini, öğle arasını, hizmetleri ve fiyatları ayarlar",
  "Dükkânın fotoğraflarını ve adresini müşteri sayfasına koyar",
  "Randevuya gelmeyen müşteriyi engeller",
];

const STEPS = [
  ["Başvurun", "Dükkânının adını, adresini ve telefonunu yaz. Birkaç dakika sürer."],
  ["Onaylanınca aç", "Başvurunu inceleyip seni arıyoruz. Sayfan açılır, panele girersin."],
  ["Bağlantını paylaş", "Müşterilerine kendi sayfanı gönder. Randevular takvimine düşer."],
];

function Pole() {
  return (
    <div className={styles.pole} aria-hidden="true">
      <span className={styles.cap} />
      <span className={styles.glass}>
        <span className={styles.stripes} />
      </span>
      <span className={`${styles.cap} ${styles.capBottom}`} />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={`${styles.head} material`}>
        <Link href="/" aria-label="Tıraş Vakti ana sayfa">
          <Logo size={30} />
        </Link>
        <div className={styles.headRight}>
          <ThemeToggle />
          {/* Geniş ekranda girişler açık; telefonda tek "Giriş" düğmesinin altında. */}
          <Link href="/admin/giris" className={styles.headQuiet}>
            Yönetici girişi
          </Link>
          <Link href="/panel/giris" className={styles.headLink}>
            Berber girişi
          </Link>
          <details className={styles.menu}>
            <summary>Giriş</summary>
            <div className={styles.menuList}>
              <Link href="/panel/giris">Berber girişi</Link>
              <Link href="/admin/giris">Yönetici girişi</Link>
            </div>
          </details>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <h1 className={styles.h1}>Berberinin randevu defteri, telefonda</h1>
            <p className={styles.lead}>
              Müşterin boş saati görüp randevusunu kendisi alır. Onay, hatırlatma ve iptal mesajı WhatsApp&apos;tan hem
              müşteriye hem sana gider. Sen günü tek ekrandan yönetirsin.
            </p>
            <div className={styles.actions}>
              <Link href="/panel/kayit" className="btn btn-primary">
                Dükkânını kaydet
              </Link>
              <Link href="/panel/giris" className="btn btn-quiet">
                Berber girişi
              </Link>
            </div>
          </div>

          <div className={styles.visual}>
            <Pole />
            <div className={styles.message}>
              <p className={styles.msgFrom}>Dükkânınız</p>
              <p>
                Randevunuz onaylandı. <strong>Salı 14:30</strong>, saç kesimi.
              </p>
              <p className={styles.msgTime}>14:02</p>
            </div>
            <div className={styles.slots}>
              <span className={styles.slot}>14:00</span>
              <span className={`${styles.slot} ${styles.slotOn}`}>14:30</span>
              <span className={styles.slot}>15:00</span>
            </div>
          </div>
        </section>

        <section className={styles.who} aria-label="Kim ne yapar">
          <div className={styles.col}>
            <h2 className={styles.h2}>Müşteri</h2>
            <ul className={styles.list}>
              {FOR_CUSTOMER.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className={styles.col}>
            <h2 className={styles.h2}>Berber</h2>
            <ul className={styles.list}>
              {FOR_BARBER.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.steps} aria-label="Nasıl başlanır">
          <h2 className={styles.h2}>Nasıl başlarsın</h2>
          <ol className={styles.stepList}>
            {STEPS.map(([title, text]) => (
              <li key={title}>
                <b>{title}</b>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <Link href="/panel/kayit" className="btn btn-primary">
            Dükkânını kaydet
          </Link>
        </section>
      </main>

      <footer className={styles.foot}>
        <div className={styles.footTop}>
          <Logo size={24} />
          <div className={styles.footLinks}>
            <Link href="/panel/giris">Berber girişi</Link>
            <Link href="/panel/kayit">Kayıt ol</Link>
            <Link href="/admin/giris">Yönetici girişi</Link>
          </div>
        </div>
        <LegalLinks />
      </footer>
    </div>
  );
}
