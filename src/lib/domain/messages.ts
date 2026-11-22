import { formatPhone, toWhatsAppNumber } from "./phone";
import { firstName } from "./names";
import { formatDayTr, formatTimeTr } from "./time";

export type MessageKind =
  | "confirm"
  | "new_booking"
  | "cancel_customer"
  | "cancel_shop"
  | "reminder"
  | "thanks";

export type MessageDraft = {
  kind: MessageKind;
  recipient: "customer" | "shop";
  /** 905XXXXXXXXX */
  toPhone: string;
  body: string;
  sendAt: Date;
};

/** Bir randevunun mesajlarda geçen bilgileri. */
export type AppointmentFacts = {
  shop: {
    name: string;
    address: string;
    phone: string;
    notifyPhone: string;
    reviewUrl: string | null;
    timeZone: string;
  };
  customer: { name: string; phone: string };
  serviceName: string;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
  source: "online" | "panel";
};

export type MessageTiming = {
  reminderMinutesBefore: number;
  thanksMinutesAfter: number;
  /** Teşekkür ve yorum isteği mesajı eklensin mi (açık rıza gerektirir). Varsayılan: evet. */
  includeThanks?: boolean;
};

function when(f: AppointmentFacts) {
  return {
    day: formatDayTr(f.startsAt, f.shop.timeZone),
    time: formatTimeTr(f.startsAt, f.shop.timeZone),
  };
}

export const templates = {
  confirm(f: AppointmentFacts): string {
    const { day, time } = when(f);
    return [
      `Merhaba ${firstName(f.customer.name)}, randevunuz oluşturuldu.`,
      "",
      `${day}, saat ${time}`,
      `${f.serviceName}, usta ${f.staffName}`,
      f.shop.address,
      "",
      `İptal etmek için bu mesaja yanıt verebilir ya da ${f.shop.phone} numarasını arayabilirsiniz.`,
      f.shop.name,
    ].join("\n");
  },
  newBooking(f: AppointmentFacts): string {
    const { day, time } = when(f);
    return [
      `Yeni randevu${f.source === "panel" ? " (dükkândan eklendi)" : ""}`,
      `${f.customer.name}, ${formatPhone(f.customer.phone)}`,
      `${day}, ${time}`,
      `${f.serviceName}, usta ${f.staffName}`,
    ].join("\n");
  },
  reminder(f: AppointmentFacts): string {
    const { time } = when(f);
    return [
      `Hatırlatma: ${firstName(f.customer.name)}, bugün saat ${time}'de ${f.shop.name}'de randevunuz var.`,
      "Gelemeyecekseniz lütfen haber verin. Görüşmek üzere!",
    ].join("\n");
  },
  thanks(f: AppointmentFacts): string {
    const lines = [
      `Sıhhatler olsun ${firstName(f.customer.name)}!`,
      "Bizi tercih ettiğiniz için teşekkür ederiz.",
    ];
    if (f.shop.reviewUrl) lines.push("Yorum yazarsanız çok seviniriz:", f.shop.reviewUrl);
    return lines.join("\n");
  },
  rescheduled(f: AppointmentFacts): string {
    const { day, time } = when(f);
    return [
      `Merhaba ${firstName(f.customer.name)}, randevunuz güncellendi.`,
      "",
      `${day}, saat ${time}`,
      `${f.serviceName}, usta ${f.staffName}`,
      f.shop.address,
      "",
      `Uymuyorsa bu mesaja yanıt verebilir ya da ${f.shop.phone} numarasını arayabilirsiniz.`,
      f.shop.name,
    ].join("\n");
  },
  rescheduledShop(f: AppointmentFacts): string {
    const { day, time } = when(f);
    return [
      "Randevu güncellendi",
      `${f.customer.name}, ${formatPhone(f.customer.phone)}`,
      `${day}, ${time}`,
      `${f.serviceName}, usta ${f.staffName}`,
    ].join("\n");
  },
  cancelCustomer(f: AppointmentFacts): string {
    const { day, time } = when(f);
    return [
      `Merhaba ${firstName(f.customer.name)}, ${day} saat ${time} randevunuz iptal edildi.`,
      "Yeni randevu almak isterseniz sizi bekleriz.",
      f.shop.name,
    ].join("\n");
  },
  cancelShop(f: AppointmentFacts, by: "customer" | "shop"): string {
    const { day, time } = when(f);
    return [
      `Randevu iptal edildi (${by === "customer" ? "müşteri iptal etti" : "dükkân iptal etti"})`,
      `${f.customer.name}, ${formatPhone(f.customer.phone)}`,
      `${day}, ${time}, ${f.serviceName}`,
    ].join("\n");
  },
};

/** Randevu alınınca kuyruğa yazılacak mesajlar. */
export function planBookingMessages(
  f: AppointmentFacts,
  timing: MessageTiming,
  now: Date,
): MessageDraft[] {
  const customerPhone = toWhatsAppNumber(f.customer.phone);
  const drafts: MessageDraft[] = [
    { kind: "confirm", recipient: "customer", toPhone: customerPhone, body: templates.confirm(f), sendAt: now },
    {
      kind: "new_booking",
      recipient: "shop",
      toPhone: toWhatsAppNumber(f.shop.notifyPhone),
      body: templates.newBooking(f),
      sendAt: now,
    },
  ];

  // Randevu çok yakınsa hatırlatma gönderilmez.
  const reminderAt = new Date(f.startsAt.getTime() - timing.reminderMinutesBefore * 60_000);
  if (reminderAt > now) {
    drafts.push({ kind: "reminder", recipient: "customer", toPhone: customerPhone, body: templates.reminder(f), sendAt: reminderAt });
  }

  if (timing.includeThanks !== false) {
    drafts.push({
      kind: "thanks",
      recipient: "customer",
      toPhone: customerPhone,
      body: templates.thanks(f),
      sendAt: new Date(f.endsAt.getTime() + timing.thanksMinutesAfter * 60_000),
    });
  }
  return drafts;
}

/** Randevu iptal edilince kuyruğa yazılacak mesajlar. */
export function planCancellationMessages(
  f: AppointmentFacts,
  by: "customer" | "shop",
  now: Date,
): MessageDraft[] {
  return [
    {
      kind: "cancel_customer",
      recipient: "customer",
      toPhone: toWhatsAppNumber(f.customer.phone),
      body: templates.cancelCustomer(f),
      sendAt: now,
    },
    {
      kind: "cancel_shop",
      recipient: "shop",
      toPhone: toWhatsAppNumber(f.shop.notifyPhone),
      body: templates.cancelShop(f, by),
      sendAt: now,
    },
  ];
}

/**
 * Randevu başka bir saate ya da ustaya taşınınca kuyruğa yazılacak mesajlar: müşteriye ve
 * dükkâna "güncellendi", yeni saate göre hatırlatma ve (önceden vardıysa) teşekkür mesajı.
 */
export function planRescheduleMessages(f: AppointmentFacts, timing: MessageTiming, now: Date): MessageDraft[] {
  const customerPhone = toWhatsAppNumber(f.customer.phone);
  const drafts: MessageDraft[] = [
    { kind: "confirm", recipient: "customer", toPhone: customerPhone, body: templates.rescheduled(f), sendAt: now },
    {
      kind: "new_booking",
      recipient: "shop",
      toPhone: toWhatsAppNumber(f.shop.notifyPhone),
      body: templates.rescheduledShop(f),
      sendAt: now,
    },
  ];
  const reminderAt = new Date(f.startsAt.getTime() - timing.reminderMinutesBefore * 60_000);
  if (reminderAt > now) {
    drafts.push({ kind: "reminder", recipient: "customer", toPhone: customerPhone, body: templates.reminder(f), sendAt: reminderAt });
  }
  if (timing.includeThanks !== false) {
    drafts.push({
      kind: "thanks",
      recipient: "customer",
      toPhone: customerPhone,
      body: templates.thanks(f),
      sendAt: new Date(f.endsAt.getTime() + timing.thanksMinutesAfter * 60_000),
    });
  }
  return drafts;
}
