import type { NextRequest } from "next/server";
import { getDb } from "@/server/db/client";
import { cancel } from "@/server/api/handlers";
import { readJson, respond } from "@/server/api/respond";

/** Müşterinin kendi randevusunu iptal etmesi. Telefon numarası eşleşmelidir. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/shops/[slug]/appointments/[id]/cancel">,
) {
  const { slug, id } = await ctx.params;
  return respond(await cancel(getDb(), slug, id, await readJson(request)));
}
