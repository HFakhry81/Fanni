CREATE TABLE "rate_limits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"hit_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "admin_role" varchar(20) DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "street" varchar(200);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "building_no" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "floor_no" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "apt_no" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" "geography(POINT, 4326)";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "national_id" varchar(14);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "national_id_front_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "national_id_back_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "license_card_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "years_of_experience" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rating" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "street" varchar(200);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "building_no" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "floor_no" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "apt_no" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "client_rating" smallint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tech_rating" smallint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "specialty_id" varchar;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "centroid" "geography(POINT, 4326)";--> statement-breakpoint
CREATE INDEX "rate_limits_key_hit_at_idx" ON "rate_limits" USING btree ("key","hit_at");