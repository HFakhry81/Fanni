CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(60) NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"body_ar" text,
	"body_en" text,
	"payload" json,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_account_config" ADD COLUMN "payment_manager_id" varchar(36);--> statement-breakpoint
ALTER TABLE "payment_requests" ADD COLUMN "sender_details" json;