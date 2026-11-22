import styles from "./Logo.module.css";

export const BRAND = "Tıraş Vakti";

/**
 * Tıraş Vakti işareti: kadranın içinde açık bir makas. Makasın iki ağzı saatin
 * akrebi ve yelkovanıdır (10'u 10 geçiyor); halkalar aşağıda, vida direğin kırmızısı.
 */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={styles.mark}
    >
      <rect width="48" height="48" rx="13" fill="#2447d6" />
      <circle cx="24" cy="24" r="18" fill="none" stroke="#fff" strokeWidth="2.6" />
      <path d="M24 9v3" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24.24 23.58L11.18 16.60Q15.67 22.15 22.40 26.77Z" fill="#fff" />
      <path d="M23.76 23.58L36.82 16.60Q32.33 22.15 25.60 26.77Z" fill="#fff" />
      <path d="M24 24L27.60 30.24M24 24L20.40 30.24" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="28.80" cy="32.31" r="3" fill="#2447d6" stroke="#fff" strokeWidth="2.2" />
      <circle cx="19.20" cy="32.31" r="3" fill="#2447d6" stroke="#fff" strokeWidth="2.2" />
      <circle cx="24" cy="24" r="2.4" fill="#e63946" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}

/** İşaret ve yazı. Yazı rengi temadan gelir; işaret her temada aynıdır. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={`${styles.logo} ${className ?? ""}`}>
      <LogoMark size={size} />
      <span className={styles.word} style={{ fontSize: Math.round(size * 0.86) }}>
        {BRAND}
      </span>
    </span>
  );
}
