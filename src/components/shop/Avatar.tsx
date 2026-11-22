import styles from "./Avatar.module.css";

type Props = {
  name: string;
  photoId?: string | null;
  size?: number;
  /** Üst üste binen avatar yığınında kullanılır. */
  ring?: boolean;
};

/** Yuvarlak fotoğraf; yoksa adın baş harfi. */
export function Avatar({ name, photoId, size = 40, ring }: Props) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.46) };
  return (
    <span className={`${styles.avatar} ${ring ? styles.ring : ""}`} style={style}>
      {photoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/photos/${photoId}`} alt="" width={size} height={size} loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden="true">{name.trim().charAt(0).toLocaleUpperCase("tr-TR")}</span>
      )}
    </span>
  );
}
