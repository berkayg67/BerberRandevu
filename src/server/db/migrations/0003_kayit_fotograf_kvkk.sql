CREATE TABLE "password_reset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"width" smallint NOT NULL,
	"height" smallint NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_photos_mime" CHECK ("shop_photos"."mime" in ('image/jpeg', 'image/webp')),
	CONSTRAINT "shop_photos_size" CHECK (octet_length("shop_photos"."data") <= 1500000)
);
--> statement-breakpoint
ALTER TABLE "shop_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_photos" ADD CONSTRAINT "shop_photos_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_reset_open_idx" ON "password_reset_requests" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "shop_photos_shop_idx" ON "shop_photos" USING btree ("shop_id","sort");--> statement-breakpoint
-- Bu göçten önce açılmış dükkânlar yönetici tarafından açıldı; onaylı sayılır.
UPDATE "shops" SET "approved_at" = "created_at" WHERE "approved_at" IS NULL;
