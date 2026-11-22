import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/home/home.module.css";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: "BerberRandevu: mahalle berberine online randevu",
  description:
    "Müşteri boş saati görüp randevusunu alır, onay ve hatırlatma WhatsApp'tan gelir. Berber günü tek ekrandan yönetir.",
};

const FOR_CUSTOMER = [
  "Hizmeti, ustayı ve boş saati seçip randevu alır",
  "Telefon numarasıyla randevularını görür, iptal eder",
  "Onay ve 1 saat önce hatırlatmayı WhatsApp'tan alır",
];

const FOR_BARBER = [
  "Günün randevularını tek listede görür",
  "Telefonla gelen randevuyu kendisi ekler",
  "Çalışma saatlerini, öğle arasını ve hizmetleri ayarlar",
  "Gelmeyen müşteriyi engeller",
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
        <Link href="/" className={styles.logo}>
          <span className={styles.mark} aria-hidden="true" />
          BerberRandevu
        </Link>
        <div className={styles.headRight}>
          <ThemeToggle />
          <Link href="/panel/giris" className={styles.headLink}>
            Berber girişi
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <h1 className={styles.h1}>Mahalle berberine telefondan randevu</h1>
            <p className={styles.lead}>
              Müşteri boş saati görüp randevusunu alır. Onay, hatırlatma ve iptal mesajı WhatsApp&apos;tan hem
              müşteriye hem berbere gider.
            </p>
            <div className={styles.actions}>
              <Link href="/berber-demo" className="btn btn-primary">
                Demo dükkânı aç
              </Link>
              <Link href="/panel/giris" className="btn btn-quiet">
                Berber girişi
              </Link>
            </div>
          </div>

          <div className={styles.visual}>
            <Pole />
            <div className={styles.message}>
              <p className={styles.msgFrom}>Berber Demo</p>
              <p>
                Randevunuz onaylandı. <strong>Salı 14:30</strong>, saç kesimi, Murat usta.
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
      </main>

      <footer className={styles.foot}>
        <span>BerberRandevu, Üsküdar</span>
        <Link href="/admin/giris" className={styles.footLink}>
          Yönetici girişi
        </Link>
      </footer>
    </div>
  );
}
