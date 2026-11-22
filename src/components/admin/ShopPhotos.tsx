"use client";

import { useTransition } from "react";
import { removeShopPhotoAction } from "@/app/admin/actions";
import styles from "./admin.module.css";

type Photo = { id: string; kind: string; width: number; height: number };
const KIND: Record<string, string> = { gallery: "Galeri", logo: "Logo", staff: "Usta" };

/** Dükkânın yüklediği fotoğraflar: uygunsuz olanı yönetici kaldırabilir. */
export function ShopPhotos({ shopId, photos }: { shopId: string; photos: Photo[] }) {
  const [busy, start] = useTransition();
  if (photos.length === 0) return <p className={styles.sub}>Dükkân henüz fotoğraf yüklememiş.</p>;
  return (
    <ul className={styles.photoGrid}>
      {photos.map((p) => (
        <li key={p.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${p.id}`} alt={`${KIND[p.kind] ?? "Fotoğraf"} fotoğrafı`} width={p.width} height={p.height} loading="lazy" />
          <span>{KIND[p.kind] ?? p.kind}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("Bu fotoğraf kaldırılsın mı?")) start(() => removeShopPhotoAction(shopId, p.id));
            }}
          >
            Kaldır
          </button>
        </li>
      ))}
    </ul>
  );
}
