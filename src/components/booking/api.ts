/** Müşteri sayfasının API istemcisi. Hata yanıtları { error: { code, message } } biçimindedir. */

export type Slot = { time: string; available: boolean };
export type Appointment = {
  id: string;
  date: string;
  time: string;
  endTime: string;
  startsAt: string;
  serviceName: string;
  staffName: string;
  priceKurus: number;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("NETWORK", "İnternet bağlantısı yok gibi görünüyor. Tekrar deneyin.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "Bir sorun oldu. Tekrar deneyin.");
  }
  return body as T;
}

export const api = {
  slots: (slug: string, q: { service: string; date: string; staff: string }, signal?: AbortSignal) =>
    call<{ date: string; slots: Slot[] }>(
      `/api/shops/${slug}/slots?${new URLSearchParams(q)}`,
      { signal },
    ),
  book: (
    slug: string,
    body: { serviceId: string; staffId: string; date: string; time: string; name: string; phone: string; consent?: boolean },
  ) =>
    call<{ appointment: Appointment; whatsappPreview: string | null }>(`/api/shops/${slug}/appointments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  lookup: (slug: string, phone: string) =>
    call<{ appointments: Appointment[] }>(`/api/shops/${slug}/appointments/lookup`, {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  cancel: (slug: string, id: string, phone: string) =>
    call<{ cancelled: true; whatsappPreview: string | null }>(`/api/shops/${slug}/appointments/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
};

/** Müşterinin adını ve telefonunu bu cihazda hatırlar (bir sonraki randevu için). */
const KEY = "berber-musteri";
export function loadCustomer(): { name: string; phone: string } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v.name === "string" && typeof v.phone === "string") return v;
  } catch {
    /* gizli sekme vb. */
  }
  return { name: "", phone: "" };
}
export function saveCustomer(v: { name: string; phone: string }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* saklanamazsa sorun değil */
  }
}
