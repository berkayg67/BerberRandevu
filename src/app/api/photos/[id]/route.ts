import { getDb } from "@/server/db/client";
import { getPublicPhoto } from "@/server/panel/photos";

const UUID = /^[0-9a-f-]{36}$/i;

/** Dükkân fotoğrafı. Kimlik değişmediği sürece içerik de değişmez; uzun süre önbellekte kalabilir. */
export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const photo = await getPublicPhoto(getDb(), id);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.data), {
    headers: {
      "content-type": photo.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
