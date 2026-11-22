"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { BookingError } from "@/server/booking/errors";
import { cancelAppointment, createAppointment, getDaySlots } from "@/server/booking/service";
import { endSession, requireOwner, startSession } from "@/server/auth/current";
import { AccountError, authenticate } from "@/server/auth/service";
import { isShopApproved, registerShop, requestPasswordReset } from "@/server/signup/service";
import { getDb } from "@/server/db/client";
import { blockCustomer, unblock } from "@/server/panel/customers";
import { setNoShow } from "@/server/panel/service";
import { saveContact, saveHours, saveProfile, saveRules, saveService, saveStaff } from "@/server/panel/settings";
import { deletePhoto, makeCover } from "@/server/panel/photos";

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
  if (user.shopId && !(await isShopApproved(getDb(), user.shopId))) {
    return {
      error: "Başvurunuz inceleniyor. Onaylandığında bu bilgilerle giriş yapabilirsiniz.",
      values: { email },
    };
  }
  await startSession(user.id);
  redirect("/panel");
}

/* ---------------- Kayıt ve şifremi unuttum ---------------- */

export type SignupState = { error?: string; done?: boolean; values?: Record<string, string> };

export async function signupAction(_prev: SignupState, fd: FormData): Promise<SignupState> {
  const values: Record<string, string> = {};
  for (const k of ["shopName", "district", "address", "ownerName", "phone", "email"]) values[k] = text(fd, k);
  try {
    await registerShop(getDb(), {
      shopName: values.shopName,
      district: values.district,
      address: values.address,
      ownerName: values.ownerName,
      phone: values.phone,
      email: values.email,
      password: String(fd.get("password") ?? ""),
      acceptTerms: fd.get("terms") === "on",
    });
    return { done: true, values: { email: values.email } };
  } catch (error) {
    if (error instanceof AccountError) return { error: error.message, values };
    console.error("[kayıt] beklenmeyen hata", error);
    return { error: "Kayıt alınamadı. Biraz sonra tekrar deneyin.", values };
  }
}

export async function forgotPasswordAction(_prev: SignupState, fd: FormData): Promise<SignupState> {
  const email = text(fd, "email");
  try {
    await requestPasswordReset(getDb(), email);
    return { done: true, values: { email } };
  } catch (error) {
    if (error instanceof AccountError) return { error: error.message, values: { email } };
    console.error("[şifre] beklenmeyen hata", error);
    return { error: "Talep alınamadı. Biraz sonra tekrar deneyin.", values: { email } };
  }
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

/* ---------------- Ayarlar ---------------- */

const num = (fd: FormData, key: string) => Number(text(fd, key));

function parseLira(value: string): number | null {
  const cleaned = value.replace(/\s|₺/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

async function settle(fn: () => Promise<string | void>): Promise<PanelFormState> {
  try {
    const ok = (await fn()) || "Kaydedildi.";
    refresh();
    return { ok };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function saveHoursAction(_prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const { shopId } = await requireOwner();
  return settle(() =>
    saveHours(getDb(), shopId, {
      week: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        weekday: d,
        hours: fd.get(`open-${d}`) === "on" ? { opens: text(fd, `opens-${d}`), closes: text(fd, `closes-${d}`) } : null,
      })),
      lunch: fd.get("lunch") === "on" ? { start: text(fd, "lunchStart"), end: text(fd, "lunchEnd") } : null,
    }),
  );
}

export async function saveRulesAction(_prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const { shopId } = await requireOwner();
  return settle(() =>
    saveRules(getDb(), shopId, {
      slotMinutes: num(fd, "slotMinutes"),
      bufferMinutes: num(fd, "bufferMinutes"),
      minNoticeMinutes: num(fd, "minNoticeMinutes"),
      bookAheadDays: num(fd, "bookAheadDays"),
      reminderMinutesBefore: num(fd, "reminderMinutesBefore"),
      thanksMinutesAfter: num(fd, "thanksMinutesAfter"),
    }),
  );
}

export async function saveProfileAction(_prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const { shopId } = await requireOwner();
  return settle(() =>
    saveProfile(getDb(), shopId, {
      name: text(fd, "name"),
      district: text(fd, "district"),
      description: String(fd.get("description") ?? ""),
    }),
  );
}

export async function deletePhotoAction(photoId: string) {
  const { shopId } = await requireOwner();
  await deletePhoto(getDb(), shopId, photoId);
  refresh();
}

export async function makeCoverAction(photoId: string) {
  const { shopId } = await requireOwner();
  try {
    await makeCover(getDb(), shopId, photoId);
  } catch (error) {
    return { error: messageOf(error) };
  }
  refresh();
  return {};
}

export async function saveContactAction(_prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const { shopId } = await requireOwner();
  return settle(() =>
    saveContact(getDb(), shopId, {
      phone: text(fd, "phone"),
      address: text(fd, "address"),
      notifyPhone: text(fd, "notifyPhone"),
      reviewUrl: text(fd, "reviewUrl"),
    }),
  );
}

export async function saveServiceAction(id: string | null, _prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const { shopId } = await requireOwner();
  return settle(async () => {
    const price = parseLira(text(fd, "price"));
    if (price === null) throw new BookingError("INVALID_INPUT", "Fiyat geçersiz. Örnek: 500");
    await saveService(getDb(), shopId, {
      id: id ?? undefined,
      name: text(fd, "name"),
      durationMinutes: num(fd, "duration"),
      priceKurus: price,
      active: id ? fd.get("active") === "on" : true,
    });
    return id ? "Kaydedildi." : "Hizmet eklendi.";
  });
}

export async function saveStaffAction(id: string | null, _prev: PanelFormState, fd: FormData): Promise<PanelFormState> {
  const { shopId } = await requireOwner();
  return settle(async () => {
    const { upcoming } = await saveStaff(getDb(), shopId, {
      id: id ?? undefined,
      name: text(fd, "name"),
      active: id ? fd.get("active") === "on" : true,
    });
    if (!id) return "Usta eklendi.";
    return upcoming
      ? `Kaydedildi. Bu ustanın ${upcoming} yaklaşan randevusu duruyor; gerekirse takvimden iptal edin.`
      : "Kaydedildi.";
  });
}
