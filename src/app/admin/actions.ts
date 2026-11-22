"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AdminError,
  createShop,
  recordPayment,
  removePayment,
  setShopActive,
  updateShop,
  type ShopInput,
} from "@/server/admin/service";
import { endSession, requireAdmin, startSession } from "@/server/auth/current";
import { authenticate } from "@/server/auth/service";
import { getDb } from "@/server/db/client";

export type FormState = {
  error?: string;
  ok?: string;
  /** Hata olduğunda formun yeniden doldurulması için gönderilen değerler. */
  values?: Record<string, string>;
};

/** Şifre dışındaki metin alanlarını geri döndürmek için. */
function valuesOf(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string" && k !== "password" && !k.startsWith("$")) out[k] = v;
  });
  return out;
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optional = (fd: FormData, key: string) => text(fd, key) || null;

/** "750", "750,50", "1.250" → kuruş; geçersizse null. */
function parseLira(value: string): number | null {
  const cleaned = value.replace(/\s|₺/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function messageOf(error: unknown): string {
  if (error instanceof AdminError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Bilgiler geçersiz.";
  console.error("[admin] beklenmeyen hata", error);
  return "Beklenmeyen bir hata oldu. Tekrar deneyin.";
}

/* ---------------- Giriş / çıkış ---------------- */

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = text(fd, "email");
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "E-posta ve şifreyi yazın.", values: { email } };

  const user = await authenticate(getDb(), email, password);
  if (!user || user.role !== "admin") {
    // Deneme yanılmayı yavaşlatmak için bekle.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "E-posta ya da şifre yanlış.", values: { email } };
  }
  await startSession(user.id);
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/giris");
}

/* ---------------- Dükkânlar ---------------- */

const shopSchema = z.object({
  name: z.string().min(2, { error: "Dükkân adını yazın." }).max(80),
  district: z.string().min(2, { error: "Semti yazın." }).max(40),
  address: z.string().min(5, { error: "Adresi yazın." }).max(200),
  phone: z.string().min(10, { error: "Dükkân telefonunu yazın." }).max(30),
  notifyPhone: z.string().min(10, { error: "WhatsApp bildirim numarasını yazın." }).max(30),
  billingStart: z.iso.date({ error: "Abonelik başlangıç tarihini seçin." }),
});

function readShop(fd: FormData): ShopInput {
  const base = shopSchema.parse({
    name: text(fd, "name"),
    district: text(fd, "district"),
    address: text(fd, "address"),
    phone: text(fd, "phone"),
    notifyPhone: text(fd, "notifyPhone"),
    billingStart: text(fd, "billingStart"),
  });
  const fee = parseLira(text(fd, "monthlyFee") || "0");
  if (fee === null) throw new AdminError("Aylık ücret geçersiz. Örnek: 750 ya da 750,50");
  return {
    ...base,
    ownerName: optional(fd, "ownerName"),
    ownerPhone: optional(fd, "ownerPhone"),
    adminNotes: optional(fd, "adminNotes"),
    monthlyFeeKurus: fee,
  };
}

export async function createShopAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let id: string;
  try {
    id = (await createShop(getDb(), readShop(fd))).id;
  } catch (error) {
    return { error: messageOf(error), values: valuesOf(fd) };
  }
  redirect(`/admin/dukkanlar/${id}`);
}

export async function updateShopAction(shopId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    await updateShop(getDb(), shopId, { ...readShop(fd), active: fd.get("active") === "on" });
  } catch (error) {
    return { error: messageOf(error), values: { ...valuesOf(fd), active: fd.get("active") === "on" ? "on" : "" } };
  }
  refresh();
  return { ok: "Kaydedildi." };
}

export async function setActiveAction(shopId: string, active: boolean) {
  await requireAdmin();
  await setShopActive(getDb(), shopId, active);
  refresh();
}

/* ---------------- Tahsilat ---------------- */

const methodSchema = z.enum(["nakit", "havale", "kart", "diger"], { error: "Ödeme yöntemini seçin." });

export async function markPaidAction(
  shopId: string,
  period: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const amount = parseLira(text(fd, "amount"));
  if (amount === null) return { error: "Tutar geçersiz. Örnek: 750", values: valuesOf(fd) };
  try {
    await recordPayment(getDb(), {
      shopId,
      period,
      amountKurus: amount,
      method: methodSchema.parse(text(fd, "method")),
      note: optional(fd, "note"),
      recordedBy: admin.id,
    });
  } catch (error) {
    return { error: messageOf(error), values: valuesOf(fd) };
  }
  refresh();
  return { ok: "Tahsilat kaydedildi." };
}

export async function undoPaymentAction(shopId: string, period: string) {
  await requireAdmin();
  await removePayment(getDb(), shopId, period);
  refresh();
}
