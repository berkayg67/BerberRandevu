import styles from "./Plate.module.css";

type PlateProps = {
  /** Üst satır, sokak tabelasındaki semt adı gibi. */
  district: string;
  /** Dükkân adı. */
  name: string;
  size?: "md" | "sm";
};

/**
 * Dükkân adını İstanbul emaye sokak tabelası gibi gösterir: lacivert emaye,
 * beyaz iç çerçeve ve iki perçin. Ekrandaki tek "parlak" öğe budur;
 * çevresindeki her şey sessiz kalır.
 */
export function Plate({ district, name, size = "md" }: PlateProps) {
  return (
    <div className={`${styles.plate} ${size === "sm" ? styles.sm : ""}`}>
      <span className={styles.rivet} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.district}>{district}</span>
        <span className={styles.name}>{name}</span>
      </span>
      <span className={styles.rivet} aria-hidden="true" />
    </div>
  );
}
