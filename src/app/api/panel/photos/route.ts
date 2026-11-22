import { getCurrentUser } from "@/server/auth/current";
import { BookingError } from "@/server/booking/errors";
import { getDb } from "@/server/db/client";
import { addPhoto, MAX_PHOTO_BYTES } from "@/server/panel/photos";

/** Berberin fotoğraf yüklemesi. Tarayıcı fotoğrafı önceden küçültür (bkz. PhotoManager). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner" || !user.shopId) {
    return Response.json({ error: "Oturumunuz kapanmış. Yeniden giriş yapın." }, { status: 401 });
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_PHOTO_BYTES + 64_000) return Response.json({ error: "Fotoğraf çok büyük." }, { status: 413 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return Response.json({ error: "Fotoğraf seçin." }, { status: 400 });
    const row = await addPhoto(getDb(), user.shopId, {
      data: new Uint8Array(await file.arrayBuffer()),
      width: Number(form.get("width")),
      height: Number(form.get("height")),
    });
    return Response.json({ id: row.id }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: 400 });
    console.error("[foto] yükleme hatası", error);
    return Response.json({ error: "Fotoğraf yüklenemedi. Tekrar deneyin." }, { status: 500 });
  }
}
