import type { NextRequest } from "next/server";
import { getDb } from "@/server/db/client";
import { book } from "@/server/api/handlers";
import { readJson, respond } from "@/server/api/respond";

/** Online randevu alır. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/shops/[slug]/appointments">) {
  const { slug } = await ctx.params;
  return respond(await book(getDb(), slug, await readJson(request)));
}
