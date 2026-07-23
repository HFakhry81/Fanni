CREATE TYPE "public"."dispute_status" AS ENUM('submitted', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."point_payment_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."point_transaction_type" AS ENUM('package_purchase', 'lead_unlock', 'dispute_refund', 'admin_adjustment', 'welcome_bonus');--> statement-breakpoint
CREATE TYPE "public"."payment_method_type" AS ENUM('bank_transfer', 'instapay', 'e_wallet');--> statement-breakpoint
CREATE TYPE "public"."payment_request_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_unlock_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'submitted' NOT NULL,
	"admin_notes" text,
	"points_refunded" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_unlocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"points_deducted" integer NOT NULL,
	"clicked_call" boolean DEFAULT false NOT NULL,
	"clicked_whatsapp" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"points_amount" integer NOT NULL,
	"price_egp" numeric(10, 2) NOT NULL,
	"original_price_egp" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unlock_costs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialty_slug" varchar(100),
	"category_slug" varchar(100),
	"points_cost" integer DEFAULT 15 NOT NULL,
	"label" varchar(200),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" varchar NOT NULL,
	"points_amount" integer NOT NULL,
	"type" "point_transaction_type" NOT NULL,
	"cash_amount_paid" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"gateway_fee_charged" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"payment_status" "point_payment_status" DEFAULT 'completed' NOT NULL,
	"external_tx_id" varchar(255),
	"description" text,
	"order_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "payment_account_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_name" varchar(100),
	"account_name" varchar(200),
	"account_number" varchar(100),
	"iban" varchar(50),
	"instapay_id" varchar(100),
	"ewallet_number" varchar(50),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"package_id" varchar,
	"amount_egp" numeric(10, 2) NOT NULL,
	"points_requested" integer NOT NULL,
	"payment_method" "payment_method_type" DEFAULT 'bank_transfer' NOT NULL,
	"reference_number" varchar(255),
	"transfer_note" text,
	"status" "payment_request_status" DEFAULT 'pending' NOT NULL,
	"admin_id" varchar,
	"admin_notes" text,
	"confirmed_at" timestamp,
	"wallet_tx_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_lead_unlock_id_lead_unlocks_id_fk" FOREIGN KEY ("lead_unlock_id") REFERENCES "public"."lead_unlocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_unlocks" ADD CONSTRAINT "lead_unlocks_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_unlocks" ADD CONSTRAINT "lead_unlocks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_package_id_point_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."point_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_wallet_tx_id_wallet_transactions_id_fk" FOREIGN KEY ("wallet_tx_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE set null ON UPDATE no action;