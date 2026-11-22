import type { NextRequest } from "next/server";
import { getDb } from "@/server/db/client";
import { lookup } from "@/server/api/handlers";
import { readJson, respond } from "@/server/api/respond";

/**
 * "Randevularım": telefon numarasına ait aktif randevular.
 * Numara adres çubuğunda ve sunucu kayıtlarında görünmesin diye GET yerine POST.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/shops/[slug]/appointments/lookup">,
) {
  const { slug } = await ctx.params;
  return respond(await lookup(getDb(), slug, await readJson(request)));
}
