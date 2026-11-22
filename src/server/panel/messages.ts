import { and, asc, desc, eq, lte, gt, type SQL } from "drizzle-orm";
import { appointments, customers, messages } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export type MessageFilter = "sirada" | "gonderildi" | "iptal" | "hepsi";

/**
 * Dükkânın mesaj kuyruğu. "Sırada" henüz gönderilmemiş olanlardır; zamanı
 * gelmiş ama gönderilmemişler de burada görünür (WhatsApp bağlanana kadar).
 */
export async function listMessages(db: Db, shopId: string, filter: MessageFilter, now: Date = new Date()) {
  const where: SQL[] = [eq(messages.shopId, shopId)];
  if (filter === "sirada") where.push(eq(messages.status, "scheduled"));
  if (filter === "gonderildi") where.push(eq(messages.status, "sent"));
  if (filter === "iptal") where.push(eq(messages.status, "cancelled"));

  const rows = await db
    .select({
      id: messages.id,
      kind: messages.kind,
      recipient: messages.recipient,
      body: messages.body,
      sendAt: messages.sendAt,
      status: messages.status,
      sentAt: messages.sentAt,
      customerName: customers.name,
    })
    .from(messages)
    .leftJoin(appointments, eq(appointments.id, messages.appointmentId))
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .where(and(...where))
    .orderBy(filter === "sirada" ? asc(messages.sendAt) : desc(messages.sendAt))
    .limit(100);

  const [due] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.shopId, shopId), eq(messages.status, "scheduled"), lte(messages.sendAt, now)))
    .limit(1);
  const [upcoming] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.shopId, shopId), eq(messages.status, "scheduled"), gt(messages.sendAt, now)))
    .limit(1);

  return { messages: rows, hasDue: !!due, hasUpcoming: !!upcoming };
}

export type QueuedMessage = Awaited<ReturnType<typeof listMessages>>["messages"][number];
