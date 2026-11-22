"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePhotoAction, makeCoverAction } from "@/app/panel/actions";
import styles from "./photos.module.css";

type Photo = { id: string; width: number; height: number };

const MAX_EDGE = 1600;
const MAX_BYTES = 1_400_000;

/** Fotoğrafı tarayıcıda küçültür: en uzun kenar 1600px, JPEG. Telefon fotoğrafları 4-8 MB'tan ~300 KB'a iner. */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of [0.84, 0.74, 0.62]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) return { blob, width, height };
  }
  throw new Error("Fotoğraf küçültülemedi.");
}

export function PhotoManager({ photos, max }: { photos: Photo[]; max: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  const left = max - photos.length;

  async function upload(files: FileList) {
    setError(undefined);
    const list = Array.from(files).slice(0, left);
    if (files.length > left) setError(`En fazla ${max} fotoğraf olabilir; ilk ${list.length} tanesi yükleniyor.`);
    for (const [i, file] of list.entries()) {
      setProgress(`Yükleniyor ${i + 1}/${list.length}`);
      try {
        const { blob, width, height } = await shrink(file);
        const body = new FormData();
        body.set("file", blob, "foto.jpg");
        body.set("width", String(width));
        body.set("height", String(height));
        const res = await fetch("/api/panel/photos", { method: "POST", body });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Fotoğraf yüklenemedi.");
          break;
        }
      } catch {
        setError(`"${file.name}" açılamadı. Telefonunuzun kamerasından JPEG fotoğraf seçin.`);
        break;
      }
    }
    setProgress(undefined);
    router.refresh();
  }

  return (
    <div>
      <div className={styles.grid}>
        {photos.map((p, i) => (
          <figure key={p.id} className={styles.item}>
            {/* Panelde küçük önizleme; özgün dosya zaten 1600px'e indirildi. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/panel/photos/${p.id}`} alt={`Dükkân fotoğrafı ${i + 1}`} width={p.width} height={p.height} loading="lazy" />
            {i === 0 && <span className={styles.cover}>Kapak</span>}
            <figcaption className={styles.actions}>
              {i > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => start(async () => setError((await makeCoverAction(p.id)).error))}
                >
                  Kapak yap
                </button>
              )}
              <button
                type="button"
                className={styles.delete}
                disabled={busy}
                onClick={() => {
                  if (confirm("Bu fotoğraf silinsin mi?")) start(() => deletePhotoAction(p.id));
                }}
              >
                Sil
              </button>
            </figcaption>
          </figure>
        ))}
        {left > 0 && (
          <label className={`${styles.add} ${progress ? styles.adding : ""}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/*"
              multiple
              disabled={Boolean(progress)}
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = "";
              }}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>{progress ?? "Fotoğraf ekle"}</span>
          </label>
        )}
      </div>
      <p className={styles.note}>
        {photos.length}/{max} fotoğraf. İlk fotoğraf kapak olur. Dükkânın içini, koltukları ve tabelayı gösteren, yatay
        çekilmiş fotoğraflar en iyi sonucu verir.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
