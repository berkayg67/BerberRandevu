import type { ApiResult } from "./handlers";

/** İşleyici sonucunu HTTP yanıtına çevirir. Randevu verisi asla önbelleğe alınmaz. */
export function respond(result: ApiResult): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Gövdesi JSON olmayan isteklerde işleyiciye boş nesne verilir; doğrulama hatayı açıklar. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
