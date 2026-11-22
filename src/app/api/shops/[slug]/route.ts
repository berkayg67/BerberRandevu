import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { shopInfo } from "@/server/api/handlers";
import { respond } from "@/server/api/respond";

/** Dükkân bilgileri, hizmetler, ustalar ve çalışma saatleri. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/shops/[slug]">) {
  await connection();
  const { slug } = await ctx.params;
  return respond(await shopInfo(getDb(), slug));
}
