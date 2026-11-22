"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePhotoAction } from "@/app/panel/actions";
import { Avatar } from "@/components/shop/Avatar";
import { shrink } from "./shrink-image";
import styles from "./photos.module.css";

/** Tek bir yuvarlak fotoğraf: dükkân logosu ya da bir ustanın fotoğrafı. */
export function PortraitUpload({
  kind,
  staffId,
  name,
  photoId,
  size = 56,
  label,
}: {
  kind: "logo" | "staff";
  staffId?: string;
  name: string;
  photoId: string | null;
  size?: number;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setError(undefined);
    setBusy(true);
    try {
      const { blob, width, height } = await shrink(file);
      const body = new FormData();
      body.set("file", blob, "foto.jpg");
      body.set("width", String(width));
      body.set("height", String(height));
      body.set("kind", kind);
      if (staffId) body.set("staffId", staffId);
      const res = await fetch("/api/panel/photos", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Fotoğraf yüklenemedi.");
      }
    } catch {
      setError("Fotoğraf açılamadı. JPEG ya da PNG bir fotoğraf seçin.");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className={styles.portrait}>
      <Avatar name={name} photoId={photoId} size={size} />
      <div className={styles.portraitActions}>
        <label className={`btn btn-quiet ${styles.smallFile}`}>
          <input
            type="file"
            accept="image/*"
            disabled={busy || pending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          {busy ? "Yükleniyor…" : photoId ? `${label} değiştir` : `${label} ekle`}
        </label>
        {photoId && (
          <button type="button" className={styles.linkDanger} disabled={busy || pending} onClick={() => start(() => deletePhotoAction(photoId))}>
            Kaldır
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
