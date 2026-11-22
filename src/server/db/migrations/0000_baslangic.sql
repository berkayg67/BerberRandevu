CREATE TYPE "public"."actor" AS ENUM('customer', 'shop');--> statement-breakpoint
CREATE TYPE "public"."appointment_source" AS ENUM('online', 'panel');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('confirm', 'new_booking', 'cancel_customer', 'cancel_shop', 'reminder', 'thanks');--> statement-breakpoint
CREATE TYPE "public"."message_recipient" AS ENUM('customer', 'shop');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('scheduled', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'active' NOT NULL,
	"source" "appointment_source" NOT NULL,
	"service_name" text NOT NULL,
	"price_kurus" integer NOT NULL,
	"no_show" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" "actor",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_order" CHECK ("appointments"."starts_at" < "appointments"."ends_at" and "appointments"."ends_at" <= "appointments"."blocked_until"),
	CONSTRAINT "appointments_cancel_consistency" CHECK (("appointments"."status" = 'cancelled') = ("appointments"."cancelled_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text,
	"phone" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_has_target" CHECK ("blocks"."name" is not null or "blocks"."phone" is not null),
	CONSTRAINT "blocks_phone_format" CHECK ("blocks"."phone" is null or "blocks"."phone" ~ '^5[0-9]{9}$')
);
--> statement-breakpoint
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_shop_phone" UNIQUE("shop_id","phone"),
	CONSTRAINT "customers_phone_format" CHECK ("customers"."phone" ~ '^5[0-9]{9}$')
);
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"appointment_id" uuid,
	"kind" "message_kind" NOT NULL,
	"recipient" "message_recipient" NOT NULL,
	"to_phone" text NOT NULL,
	"body" text NOT NULL,
	"send_at" timestamp with time zone NOT NULL,
	"status" "message_status" DEFAULT 'scheduled' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" smallint NOT NULL,
	"price_kurus" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_duration" CHECK ("services"."duration_minutes" between 5 and 240),
	CONSTRAINT "services_price" CHECK ("services"."price_kurus" >= 0)
);
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"district" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"notify_phone" text NOT NULL,
	"review_url" text,
	"timezone" text DEFAULT 'Europe/Istanbul' NOT NULL,
	"slot_minutes" smallint DEFAULT 15 NOT NULL,
	"buffer_minutes" smallint DEFAULT 5 NOT NULL,
	"min_notice_minutes" smallint DEFAULT 30 NOT NULL,
	"book_ahead_days" smallint DEFAULT 14 NOT NULL,
	"reminder_minutes_before" smallint DEFAULT 60 NOT NULL,
	"thanks_minutes_after" smallint DEFAULT 30 NOT NULL,
	"break_start" time,
	"break_end" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_slug_unique" UNIQUE("slug"),
	CONSTRAINT "shops_slug_format" CHECK ("shops"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "shops_break_valid" CHECK (("shops"."break_start" is null and "shops"."break_end" is null) or ("shops"."break_start" < "shops"."break_end"))
);
--> statement-breakpoint
ALTER TABLE "shops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "working_hours" (
	"shop_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"opens" time NOT NULL,
	"closes" time NOT NULL,
	CONSTRAINT "working_hours_shop_id_weekday_pk" PRIMARY KEY("shop_id","weekday"),
	CONSTRAINT "working_hours_weekday" CHECK ("working_hours"."weekday" between 0 and 6),
	CONSTRAINT "working_hours_order" CHECK ("working_hours"."opens" < "working_hours"."closes")
);
--> statement-breakpoint
ALTER TABLE "working_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_shop_starts_idx" ON "appointments" USING btree ("shop_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "blocks_shop_idx" ON "blocks" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "messages_due_idx" ON "messages" USING btree ("status","send_at");--> statement-breakpoint
CREATE INDEX "messages_appointment_idx" ON "messages" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "services_shop_idx" ON "services" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "staff_shop_idx" ON "staff" USING btree ("shop_id");