CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid,
	"target" text NOT NULL,
	"reason" text NOT NULL,
	"details" text NOT NULL,
	"contact" text,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_closures_order" CHECK ("shop_closures"."starts_on" <= "shop_closures"."ends_on")
);
--> statement-breakpoint
ALTER TABLE "shop_closures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_slug_redirects" (
	"old_slug" text PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_slug_redirects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "shop_photos" ADD COLUMN "kind" text DEFAULT 'gallery' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_photos" ADD COLUMN "staff_id" uuid;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_closures" ADD CONSTRAINT "shop_closures_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_slug_redirects" ADD CONSTRAINT "shop_slug_redirects_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_reports_open_idx" ON "content_reports" USING btree ("resolved_at","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shop_closures_shop_idx" ON "shop_closures" USING btree ("shop_id","starts_on");--> statement-breakpoint
CREATE INDEX "shop_slug_redirects_shop_idx" ON "shop_slug_redirects" USING btree ("shop_id");--> statement-breakpoint
ALTER TABLE "shop_photos" ADD CONSTRAINT "shop_photos_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_photos_one_logo" ON "shop_photos" USING btree ("shop_id") WHERE "shop_photos"."kind" = 'logo';--> statement-breakpoint
CREATE UNIQUE INDEX "shop_photos_one_per_staff" ON "shop_photos" USING btree ("staff_id") WHERE "shop_photos"."kind" = 'staff';--> statement-breakpoint
ALTER TABLE "shop_photos" ADD CONSTRAINT "shop_photos_kind" CHECK ("shop_photos"."kind" in ('gallery', 'logo', 'staff'));--> statement-breakpoint
ALTER TABLE "shop_photos" ADD CONSTRAINT "shop_photos_staff_link" CHECK (("shop_photos"."kind" = 'staff') = ("shop_photos"."staff_id" is not null));