import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { daySlots } from "@/server/api/handlers";
import { respond } from "@/server/api/respond";

/** Bir günün boş ve dolu saatleri: ?service=<id>&date=2026-11-20&staff=any */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/shops/[slug]/slots">) {
  await connection();
  const { slug } = await ctx.params;
  return respond(await daySlots(getDb(), slug, request.nextUrl.searchParams));
}
