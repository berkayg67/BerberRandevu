import { getCurrentUser } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { getOwnPhoto } from "@/server/panel/photos";

const UUID = /^[0-9a-f-]{36}$/i;

/** Berberin kendi fotoğrafı; dükkân henüz onaylanmamış olsa da panelde görünür. */
export async function GET(_req: Request, ctx: RouteContext<"/api/panel/photos/[id]">) {
  const user = await getCurrentUser();
  const { id } = await ctx.params;
  if (!user?.shopId || !UUID.test(id)) return new Response(null, { status: 404 });
  const photo = await getOwnPhoto(getDb(), user.shopId, id);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.data), {
    headers: { "content-type": photo.mime, "cache-control": "private, max-age=31536000, immutable" },
  });
}
