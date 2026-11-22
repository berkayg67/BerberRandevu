import type { PublicShop } from "@/server/shops/service";
import { formatPrice } from "@/lib/domain/money";
import { Avatar } from "./Avatar";
import styles from "./ShopInfo.module.css";

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Randevu sekmesinin alt bölümleri: hizmet fiyatları, ustalar ve adres, saatler, fotoğraflar. */
export function ShopInfo({ shop }: { shop: PublicShop }) {
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${shop.address} ${shop.district}`)}`;
  return (
    <>
      {shop.description && (
        <section className={styles.section}>
          <p className={styles.about}>{shop.description}</p>
        </section>
      )}

      {shop.photos.length > 0 && (
        <section className={styles.section} aria-label={`${shop.name} fotoğrafları`}>
          <ul className={styles.gallery}>
            {shop.photos.map((p, i) => (
              <li key={p.id}>
                {/* Fotoğraflar yüklenirken 1600px'e indirildi; ayrıca işlenmeden sunulur. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${p.id}`}
                  alt={i === 0 ? `${shop.name} dükkânı` : ""}
                  width={p.width}
                  height={p.height}
                  loading="lazy"
                  decoding="async"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="h-team">
        <h2 id="h-team" className={styles.h2}>
          Ustalarımız ve adres
        </h2>
        {shop.staff.length > 0 && (
          <ul className={styles.team}>
            {shop.staff.map((s) => (
              <li key={s.id}>
                <Avatar name={s.name} photoId={s.photoId} size={56} />
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.card}>
          <p className={styles.address}>
            {shop.address}
            <span>{shop.district}</span>
          </p>
          <div className={styles.actions}>
            <a className="btn btn-quiet" href={mapHref} target="_blank" rel="noopener noreferrer">
              Yol tarifi
            </a>
            <a className="btn btn-quiet" href={`tel:+90${shop.phone}`}>
              Ara
            </a>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="h-hours">
        <h2 id="h-hours" className={styles.h2}>
          Çalışma saatleri
        </h2>
        <dl className={styles.hours}>
          {ORDER.map((d) => {
            const h = shop.hours.find((x) => x.weekday === d);
            return (
              <div key={d}>
                <dt>{DAYS[d]}</dt>
                <dd className="num">{h ? `${h.opens} – ${h.closes}` : "Kapalı"}</dd>
              </div>
            );
          })}
          {shop.lunch && (
            <div>
              <dt>Öğle arası</dt>
              <dd className="num">
                {shop.lunch.start} – {shop.lunch.end}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {shop.services.length > 0 && (
        <section className={styles.section} aria-labelledby="h-prices">
          <h2 id="h-prices" className={styles.h2}>
            Hizmetler ve fiyatlar
          </h2>
          <ul className={styles.prices}>
            {shop.services.map((s) => (
              <li key={s.id}>
                <span>
                  {s.name}
                  <small>{s.durationMinutes} dk</small>
                </span>
                <b className="num">{formatPrice(s.priceKurus)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
