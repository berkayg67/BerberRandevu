import { getCurrentUser } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { getAnyPhoto } from "@/server/panel/photos";
import { getPublicPhoto } from "@/server/panel/photos";

const UUID = /^[0-9a-f-]{36}$/i;

/** Dükkân fotoğrafı. Kimlik değişmedikçe içerik de değişmez; kaldırılan içerik önbellekte en fazla bir gün kalır. */
export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  let photo = await getPublicPhoto(getDb(), id);
  // Onaylanmamış dükkânların fotoğraflarını yalnızca yönetici görebilir.
  if (!photo && (await getCurrentUser())?.role === "admin") photo = await getAnyPhoto(getDb(), id);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.data), {
    headers: {
      "content-type": photo.mime,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
