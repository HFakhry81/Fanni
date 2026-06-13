CREATE TYPE "public"."user_role" AS ENUM('client', 'technician');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'acknowledged', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('technician', 'client', 'admin');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('governorate', 'area', 'neighborhood');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"mobile" varchar(20),
	"password_hash" varchar,
	"profile_image_url" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"permissions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email"),
	CONSTRAINT "admins_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
CREATE TABLE "availability_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"technician_id" varchar NOT NULL,
	"changed_by_id" varchar NOT NULL,
	"changed_by_role" varchar(20) NOT NULL,
	"old_value" boolean NOT NULL,
	"new_value" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"identifier" varchar NOT NULL,
	"role" varchar,
	"success" boolean NOT NULL,
	"failure_reason" varchar,
	"ip_address" varchar,
	"user_agent" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token_hash" varchar NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mobile" varchar(20) NOT NULL,
	"code_hash" varchar NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_domains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" varchar(100) DEFAULT '' NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"icon" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_specializations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" varchar NOT NULL,
	"name_en" varchar(100) DEFAULT '' NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" "user_role",
	"mobile" varchar(20),
	"governorate" varchar(100),
	"area" varchar(100),
	"district" varchar(100),
	"address" varchar(500),
	"profession" varchar(100),
	"specialty" varchar(100),
	"location" geography(POINT, 4326),
	"service_categories" jsonb,
	"service_start" varchar(5),
	"service_end" varchar(5),
	"is_available" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_hash" varchar,
	"expo_push_token" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"order_serial" serial NOT NULL,
	"order_number" varchar NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"client_id" varchar,
	"technician_id" varchar,
	"category" varchar(100),
	"governorate" varchar(100),
	"area" varchar(100),
	"location" geography(POINT, 4326),
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "orders_order_serial_unique" UNIQUE("order_serial")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_serial" serial NOT NULL,
	"order_id" varchar,
	"order_number" varchar(100),
	"client_id" varchar,
	"technician_id" varchar,
	"category" varchar(100),
	"invoice_type" "invoice_type",
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '14' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'EGP' NOT NULL,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"note_ar" text,
	"note_en" text,
	"materials_photos" jsonb,
	"ocr_line_items" jsonb,
	"ocr_materials_total" numeric(10, 2),
	"labour_fee" numeric(10, 2),
	"transport_fee" numeric(10, 2),
	"service_fee_rate" numeric(5, 2) DEFAULT '15',
	"service_fee_amount" numeric(10, 2),
	"vat_rate" numeric(5, 2) DEFAULT '14',
	"vat_amount" numeric(10, 2),
	"net_total" numeric(10, 2),
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_serial_unique" UNIQUE("invoice_serial")
);
--> statement-breakpoint
CREATE TABLE "location_aliases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" varchar NOT NULL,
	"alias" varchar(300) NOT NULL,
	"note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_miss_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suburb_en" varchar(300),
	"suburb_ar" varchar(300),
	"city_en" varchar(300),
	"city_ar" varchar(300),
	"lat" varchar(50),
	"lng" varchar(50),
	"seen_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"type" "location_type" NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"parent_id" varchar,
	"slug" varchar(200) NOT NULL,
	"centroid" geography(POINT, 4326)
);
--> statement-breakpoint
CREATE TABLE "nominatim_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" varchar(500) NOT NULL,
	"lang" varchar(5) DEFAULT 'ar' NOT NULL,
	"response_json" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "nominatim_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
ALTER TABLE "availability_audit_logs" ADD CONSTRAINT "availability_audit_logs_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_specializations" ADD CONSTRAINT "service_specializations_domain_id_service_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."service_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_aliases" ADD CONSTRAINT "location_aliases_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_audit_logs_tech_id_idx" ON "availability_audit_logs" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "availability_audit_logs_created_at_idx" ON "availability_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "login_logs_created_at_idx" ON "login_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "login_logs_user_id_idx" ON "login_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_reset_token_user" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_phone_verif_mobile" ON "phone_verifications" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX "service_specializations_domain_id_idx" ON "service_specializations" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "IDX_orders_client" ON "orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "IDX_orders_tech" ON "orders" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "IDX_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_orders_serial" ON "orders" USING btree ("order_serial");--> statement-breakpoint
CREATE INDEX "IDX_invoices_client" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "IDX_invoices_tech" ON "invoices" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "IDX_invoices_order" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "IDX_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_invoices_serial" ON "invoices" USING btree ("invoice_serial");--> statement-breakpoint
CREATE INDEX "IDX_invoices_type" ON "invoices" USING btree ("invoice_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_location_aliases_location_alias" ON "location_aliases" USING btree ("location_id","alias");--> statement-breakpoint
CREATE INDEX "IDX_location_aliases_location" ON "location_aliases" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "IDX_location_aliases_alias" ON "location_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "IDX_loc_miss_suburb_en" ON "location_miss_log" USING btree ("suburb_en");--> statement-breakpoint
CREATE INDEX "IDX_loc_miss_city_en" ON "location_miss_log" USING btree ("city_en");--> statement-breakpoint
CREATE INDEX "IDX_loc_miss_last_seen" ON "location_miss_log" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "IDX_locations_type" ON "locations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_locations_parent" ON "locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "IDX_locations_slug" ON "locations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "IDX_nominatim_key" ON "nominatim_cache" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "IDX_nominatim_expires" ON "nominatim_cache" USING btree ("expires_at");