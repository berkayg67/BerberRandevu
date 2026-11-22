import type { ReactNode } from "react";
import { Plate } from "@/components/ui/Plate";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import styles from "./ShopHero.module.css";

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type ShopHeroProps = {
  district: string;
  name: string;
  address: string;
  /** Adresin üstünde gösterilen durum satırı (açık / kapalı). */
  status?: ReactNode;
  /** Haftalık saatler; geniş ekranda fayans duvarında listelenir. */
  hours?: { weekday: number; opens: string; closes: string }[];
  lunch?: { start: string; end: string } | null;
  description?: string | null;
  photos?: { id: string; width: number; height: number }[];
};

/** Müşteri sayfasının fayans duvarı: emaye tabela, durum, adres ve (geniş ekranda) saatler. */
export function ShopHero({ district, name, address, status, hours, lunch, description, photos = [] }: ShopHeroProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.top}>
        <ThemeToggle />
      </div>
      <h1 className={styles.title}>
        <Plate district={district} name={name} />
      </h1>
      <div className={styles.facts}>
        {status}
        <p className={styles.address}>{address}</p>
      </div>
      {description && <p className={styles.description}>{description}</p>}
      {photos.length > 0 && (
        <ul className={styles.gallery} aria-label={`${name} fotoğrafları`}>
          {photos.map((p, i) => (
            <li key={p.id}>
              {/* Fotoğraflar yüklenirken 1600px'e indirildi; ayrıca işlenmeden sunulur. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${p.id}`}
                alt={i === 0 ? `${name} dükkânı` : ""}
                width={p.width}
                height={p.height}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </li>
          ))}
        </ul>
      )}
      {hours && (
        <dl className={styles.hours} aria-label="Çalışma saatleri">
          {ORDER.map((d) => {
            const h = hours.find((x) => x.weekday === d);
            return (
              <div key={d}>
                <dt>{DAYS[d]}</dt>
                <dd className="num">{h ? `${h.opens} – ${h.closes}` : "Kapalı"}</dd>
              </div>
            );
          })}
          {lunch && (
            <div className={styles.lunch}>
              <dt>Öğle arası</dt>
              <dd className="num">
                {lunch.start} – {lunch.end}
              </dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}
