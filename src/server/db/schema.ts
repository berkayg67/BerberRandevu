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
  customType,
  date,
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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Fotoğraf baytları. postgres.js Buffer döner, PGlite Uint8Array; ikisi de Uint8Array'dir. */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

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
export const userRole = pgEnum("user_role", ["admin", "owner"]);
export const paymentMethod = pgEnum("payment_method", ["nakit", "havale", "kart", "diger"]);
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
    /** Kapalı dükkân online randevu almaz ve müşteri sayfası açılmaz. */
    active: boolean("active").notNull().default(true),
    /** Aylık abonelik ücreti (kuruş). */
    monthlyFeeKurus: integer("monthly_fee_kurus").notNull().default(0),
    /** Abonelik bu tarihten itibaren ücretlendirilir. */
    billingStart: date("billing_start").notNull().defaultNow(),
    ownerName: text("owner_name"),
    ownerPhone: text("owner_phone"),
    /** Yalnızca yöneticinin gördüğü notlar. */
    adminNotes: text("admin_notes"),
    /** Müşteri sayfasında görünen kısa tanıtım. */
    description: text("description"),
    /** Kayıt başvurusu onaylandığı an. Boşsa başvuru yönetici onayı bekliyor. */
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("shops_fee", sql`${t.monthlyFeeKurus} >= 0`),
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
    /** KVKK aydınlatma metni ve WhatsApp bildirimi için açık rızanın en son verildiği an. */
    consentAt: timestamp("consent_at", { withTimezone: true }),
    /** Yalnızca berberin gördüğü not ("sakalı kısa ister" gibi). */
    note: text("note"),
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
    /** Yalnızca berberin gördüğü randevu notu. */
    note: text("note"),
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

/**
 * Panel kullanıcıları. "admin" tüm dükkânları yönetir; "owner" (5. adım)
 * yalnızca kendi dükkânını.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Kullanım koşulları ve KVKK metninin kabul edildiği an (kendi kaydolan berberler). */
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("users_email_lower", sql`${t.email} = lower(${t.email})`),
    check("users_owner_has_shop", sql`(${t.role} = 'owner') = (${t.shopId} is not null)`),
  ],
).enableRLS();

/** Oturumlar. Çerezdeki anahtarın kendisi değil, SHA-256 özeti saklanır. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
).enableRLS();

/** Abonelik tahsilatları. Bir dükkânın bir ayı için en fazla bir kayıt; kayıt varsa o ay ödenmiştir. */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    /** "2026-11" */
    period: text("period").notNull(),
    amountKurus: integer("amount_kurus").notNull(),
    method: paymentMethod("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("payments_shop_period").on(t.shopId, t.period),
    check("payments_period_format", sql`${t.period} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("payments_amount", sql`${t.amountKurus} >= 0`),
  ],
).enableRLS();

/** "Şifremi unuttum" talepleri. Yönetici yeni şifre üretip berbere iletir. */
export const passwordResetRequests = pgTable(
  "password_reset_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("password_reset_open_idx").on(t.resolvedAt)],
).enableRLS();

/**
 * Dükkân görselleri: galeri fotoğrafları, dükkân logosu ve usta fotoğrafları.
 * Tarayıcıda küçültülüp (en uzun kenar 1600px, JPEG) veritabanında saklanır.
 * Dükkânın en fazla bir logosu, her ustanın en fazla bir fotoğrafı olur.
 */
export const shopPhotos = pgTable(
  "shop_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    /** gallery | logo | staff */
    kind: text("kind").notNull().default("gallery"),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    mime: text("mime").notNull(),
    data: bytea("data").notNull(),
    width: smallint("width").notNull(),
    height: smallint("height").notNull(),
    sort: smallint("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("shop_photos_shop_idx").on(t.shopId, t.sort),
    uniqueIndex("shop_photos_one_logo").on(t.shopId).where(sql`${t.kind} = 'logo'`),
    uniqueIndex("shop_photos_one_per_staff").on(t.staffId).where(sql`${t.kind} = 'staff'`),
    check("shop_photos_mime", sql`${t.mime} in ('image/jpeg', 'image/webp')`),
    check("shop_photos_size", sql`octet_length(${t.data}) <= 1500000`),
    check("shop_photos_kind", sql`${t.kind} in ('gallery', 'logo', 'staff')`),
    check("shop_photos_staff_link", sql`(${t.kind} = 'staff') = (${t.staffId} is not null)`),
  ],
).enableRLS();

/** E-postayla gelen şifre sıfırlama bağlantıları. Bağlantıdaki anahtarın yalnızca SHA-256 özeti saklanır. */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("password_reset_tokens_user_idx").on(t.userId)],
).enableRLS();

/** Dükkânın kapalı olduğu günler (tatil, izin). Bu günlerde online randevu verilmez. */
export const shopClosures = pgTable(
  "shop_closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("shop_closures_shop_idx").on(t.shopId, t.startsOn),
    check("shop_closures_order", sql`${t.startsOn} <= ${t.endsOn}`),
  ],
).enableRLS();

/** Dükkân adresi değişince eski adres yeni adrese yönlendirilir; paylaşılmış linkler bozulmaz. */
export const shopSlugRedirects = pgTable(
  "shop_slug_redirects",
  {
    oldSlug: text("old_slug").primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("shop_slug_redirects_shop_idx").on(t.shopId)],
).enableRLS();

/** Ziyaretçilerin bildirdiği içerikler (5651 sayılı Kanun kapsamında "içeriği bildir"). */
export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "set null" }),
    /** Bildirilen sayfa adresi ya da açıklaması. */
    target: text("target").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull(),
    contact: text("contact"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    createdAt: createdAt(),
  },
  (t) => [index("content_reports_open_idx").on(t.resolvedAt, t.createdAt)],
).enableRLS();
