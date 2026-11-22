"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { BookingError } from "@/server/booking/errors";
import { cancelAppointment, createAppointment, getDaySlots } from "@/server/booking/service";
import { endSession, requireOwner, startSession } from "@/server/auth/current";
import { authenticate } from "@/server/auth/service";
import { getDb } from "@/server/db/client";
import { blockCustomer, unblock } from "@/server/panel/customers";
import { setNoShow } from "@/server/panel/service";

export type PanelFormState = {
  error?: string;
  ok?: string;
  /** Engelli müşteri için onay gerekiyor. */
  needsConfirm?: boolean;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function messageOf(error: unknown): string {
  if (error instanceof BookingError) return error.message;
  console.error("[panel] beklenmeyen hata", error);
  return "Beklenmeyen bir hata oldu. Tekrar deneyin.";
}

/* ---------------- Giriş / çıkış ---------------- */

export async function loginOwner(_prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const email = text(fd, "email");
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "E-posta ve şifreyi yazın.", values: { email } };
  const user = await authenticate(getDb(), email, password);
  if (!user || user.role !== "owner") {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "E-posta ya da şifre yanlış.", values: { email } };
  }
  await startSession(user.id);
  redirect("/panel");
}

export async function logoutOwner() {
  await endSession();
  redirect("/panel/giris");
}

/* ---------------- Takvim ---------------- */

/** Randevu ekleme penceresi için o günün boş saatleri. */
export async function panelSlotsAction(input: { serviceId: string; staffId: string; date: string }) {
  const { shopId } = await requireOwner();
  try {
    const slots = await getDaySlots(getDb(), { shopId, serviceId: input.serviceId, date: input.date, source: "panel" });
    const times = slots
      .filter((s) => (input.staffId === "any" ? s.freeStaffIds.length > 0 : s.freeStaffIds.includes(input.staffId)))
      .map((s) => s.time);
    return { times };
  } catch (error) {
    return { times: [] as string[], error: messageOf(error) };
  }
}

export async function addAppointmentAction(_prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const { shopId } = await requireOwner();
  const values: Record<string, string> = {};
  fd.forEach((v, k) => typeof v === "string" && !k.startsWith("$") && (values[k] = v));
  try {
    await createAppointment(getDb(), {
      shopId,
      serviceId: text(fd, "serviceId"),
      staffId: text(fd, "staffId") || "any",
      date: text(fd, "date"),
      time: text(fd, "time"),
      customerName: text(fd, "name"),
      customerPhone: text(fd, "phone"),
      source: "panel",
      allowBlocked: text(fd, "confirmBlocked") === "1",
    });
  } catch (error) {
    if (error instanceof BookingError && error.code === "BLOCKED") {
      return {
        needsConfirm: true,
        error: "Bu müşteri engelli listenizde. Yine de randevu vermek için tekrar onaylayın.",
        values,
      };
    }
    return { error: messageOf(error), values };
  }
  refresh();
  return { ok: "Randevu eklendi. Müşteriye onay mesajı gönderilecek." };
}

export async function cancelByShopAction(appointmentId: string): Promise<{ error?: string }> {
  const { shopId } = await requireOwner();
  try {
    await cancelAppointment(getDb(), { shopId, appointmentId, by: "shop" });
  } catch (error) {
    return { error: messageOf(error) };
  }
  refresh();
  return {};
}

export async function setNoShowAction(appointmentId: string, noShow: boolean): Promise<{ error?: string }> {
  const { shopId } = await requireOwner();
  try {
    await setNoShow(getDb(), { shopId, appointmentId, noShow });
  } catch (error) {
    return { error: messageOf(error) };
  }
  refresh();
  return {};
}

/* ---------------- Müşteriler ---------------- */

export async function blockAction(_prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const { shopId } = await requireOwner();
  try {
    const { cancelled } = await blockCustomer(getDb(), {
      shopId,
      name: text(fd, "name") || null,
      phone: text(fd, "phone") || null,
      note: text(fd, "note") || null,
    });
    refresh();
    return {
      ok: cancelled
        ? `Engellendi. Yaklaşan ${cancelled} randevusu iptal edildi ve kendisine haber verildi.`
        : "Engellendi.",
    };
  } catch (error) {
    const values: Record<string, string> = {};
    fd.forEach((v, k) => typeof v === "string" && !k.startsWith("$") && (values[k] = v));
    return { error: messageOf(error), values };
  }
}

export async function unblockAction(blockId: string) {
  const { shopId } = await requireOwner();
  await unblock(getDb(), shopId, blockId);
  refresh();
}
