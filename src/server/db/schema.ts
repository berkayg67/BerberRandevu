/**
 * Veritabanı şeması.
 *
 * Kurallar:
 * - Her tablo `shop_id` taşır; tek veritabanında birden çok dükkân birbirinin
 *   verisini görmeden durur.
 * - Saatler UTC (timestamptz) saklanır, ekranda dükkânın saat dilimine çevrilir.
 * - Para kuruş cinsinden tam sayıdır (700 ₺ = 70000).
 * - Telefonlar başında 0 olmadan 10 hane saklanır: 5XXXXXXXXX.
 * - Tüm tablolarda RLS açıktır ve politika yoktur: Supabase'in herkese açık
 *   API'si tablolara erişemez, erişim yalnızca sunucudaki koddan yapılır.
 * - Aynı ustaya üst üste binen randevuyu engelleyen kural
 *   (exclusion constraint) 0001 numaralı özel göçtedir.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const appointmentStatus = pgEnum("appointment_status", ["active", "cancelled"]);
export const actor = pgEnum("actor", ["customer", "shop"]);
export const appointmentSource = pgEnum("appointment_source", ["online", "panel"]);
export const messageKind = pgEnum("message_kind", [
  "confirm",
  "new_booking",
  "cancel_customer",
  "cancel_shop",
  "reminder",
  "thanks",
]);
export const messageRecipient = pgEnum("message_recipient", ["customer", "shop"]);
export const messageStatus = pgEnum("message_status", [
  "scheduled",
  "sent",
  "failed",
  "cancelled",
]);

export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    district: text("district").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    /** Dükkâna giden bildirimlerin WhatsApp numarası (5XXXXXXXXX). */
    notifyPhone: text("notify_phone").notNull(),
    reviewUrl: text("review_url"),
    timezone: text("timezone").notNull().default("Europe/Istanbul"),
    slotMinutes: smallint("slot_minutes").notNull().default(15),
    bufferMinutes: smallint("buffer_minutes").notNull().default(5),
    minNoticeMinutes: smallint("min_notice_minutes").notNull().default(30),
    bookAheadDays: smallint("book_ahead_days").notNull().default(14),
    reminderMinutesBefore: smallint("reminder_minutes_before").notNull().default(60),
    thanksMinutesAfter: smallint("thanks_minutes_after").notNull().default(30),
    breakStart: time("break_start"),
    breakEnd: time("break_end"),
    createdAt: createdAt(),
  },
  (t) => [
    check("shops_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check(
      "shops_break_valid",
      sql`(${t.breakStart} is null and ${t.breakEnd} is null) or (${t.breakStart} < ${t.breakEnd})`,
    ),
  ],
).enableRLS();

/** Haftanın günü: 0 = Pazar ... 6 = Cumartesi. Satırı olmayan gün kapalıdır. */
export const workingHours = pgTable(
  "working_hours",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    opens: time("opens").notNull(),
    closes: time("closes").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.weekday] }),
    check("working_hours_weekday", sql`${t.weekday} between 0 and 6`),
    check("working_hours_order", sql`${t.opens} < ${t.closes}`),
  ],
).enableRLS();

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    sort: smallint("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("staff_shop_idx").on(t.shopId)],
).enableRLS();

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    durationMinutes: smallint("duration_minutes").notNull(),
    priceKurus: integer("price_kurus").notNull(),
    active: boolean("active").notNull().default(true),
    sort: smallint("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("services_shop_idx").on(t.shopId),
    check("services_duration", sql`${t.durationMinutes} between 5 and 240`),
    check("services_price", sql`${t.priceKurus} >= 0`),
  ],
).enableRLS();

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("customers_shop_phone").on(t.shopId, t.phone),
    check("customers_phone_format", sql`${t.phone} ~ '^5[0-9]{9}$'`),
  ],
).enableRLS();

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** Bitiş + randevular arası boşluk. Çakışma kontrolü bu aralıkla yapılır. */
    blockedUntil: timestamp("blocked_until", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("active"),
    source: appointmentSource("source").notNull(),
    /** Randevu anındaki hizmet adı ve fiyatı; hizmet sonradan değişse de korunur. */
    serviceName: text("service_name").notNull(),
    priceKurus: integer("price_kurus").notNull(),
    noShow: boolean("no_show").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: actor("cancelled_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("appointments_shop_starts_idx").on(t.shopId, t.startsAt),
    index("appointments_customer_idx").on(t.customerId),
    check("appointments_order", sql`${t.startsAt} < ${t.endsAt} and ${t.endsAt} <= ${t.blockedUntil}`),
    check(
      "appointments_cancel_consistency",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null)`,
    ),
  ],
).enableRLS();

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name"),
    phone: text("phone"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("blocks_shop_idx").on(t.shopId),
    check("blocks_has_target", sql`${t.name} is not null or ${t.phone} is not null`),
    check("blocks_phone_format", sql`${t.phone} is null or ${t.phone} ~ '^5[0-9]{9}$'`),
  ],
).enableRLS();

/**
 * Giden mesaj kuyruğu (outbox). Randevu işlemleri mesajları buraya yazar;
 * ayrı bir işçi zamanı gelenleri WhatsApp'a gönderir (yol haritası 6. adım).
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    kind: messageKind("kind").notNull(),
    recipient: messageRecipient("recipient").notNull(),
    /** Ülke koduyla, işaretsiz: 905XXXXXXXXX */
    toPhone: text("to_phone").notNull(),
    body: text("body").notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: messageStatus("status").notNull().default("scheduled"),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_due_idx").on(t.status, t.sendAt),
    index("messages_appointment_idx").on(t.appointmentId),
  ],
).enableRLS();
