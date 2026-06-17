CREATE TYPE "public"."life_status" AS ENUM('active', 'finished', 'archived');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('ru', 'ky');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_dilemmas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dilemma_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dilemma_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"choice_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "life_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"age" integer DEFAULT 0 NOT NULL,
	"stats" jsonb NOT NULL,
	"flags" jsonb NOT NULL,
	"debts" jsonb NOT NULL,
	"key_decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"diary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"season_outcome" text DEFAULT '' NOT NULL,
	"epilogue" text,
	"seed" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slot_index" integer NOT NULL,
	"character_id" text NOT NULL,
	"status" "life_status" DEFAULT 'active' NOT NULL,
	"current_season" integer DEFAULT 1 NOT NULL,
	"age" integer NOT NULL,
	"stats" jsonb NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"debts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seed" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "season_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"life_index" numeric(12, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "share_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"life_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_endings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ending_id" text NOT NULL,
	"life_id" uuid,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_knowledge_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"life_id" uuid,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"email" text,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"locale" "locale" DEFAULT 'ru' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dilemma_answers" ADD CONSTRAINT "dilemma_answers_dilemma_id_daily_dilemmas_id_fk" FOREIGN KEY ("dilemma_id") REFERENCES "public"."daily_dilemmas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dilemma_answers" ADD CONSTRAINT "dilemma_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "life_snapshots" ADD CONSTRAINT "life_snapshots_life_id_lives_id_fk" FOREIGN KEY ("life_id") REFERENCES "public"."lives"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lives" ADD CONSTRAINT "lives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "season_results" ADD CONSTRAINT "season_results_life_id_lives_id_fk" FOREIGN KEY ("life_id") REFERENCES "public"."lives"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "season_results" ADD CONSTRAINT "season_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_life_id_lives_id_fk" FOREIGN KEY ("life_id") REFERENCES "public"."lives"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_endings" ADD CONSTRAINT "user_endings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_endings" ADD CONSTRAINT "user_endings_life_id_lives_id_fk" FOREIGN KEY ("life_id") REFERENCES "public"."lives"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_knowledge_cards" ADD CONSTRAINT "user_knowledge_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_knowledge_cards" ADD CONSTRAINT "user_knowledge_cards_life_id_lives_id_fk" FOREIGN KEY ("life_id") REFERENCES "public"."lives"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dilemmas_date_uniq" ON "daily_dilemmas" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dilemma_answers_uniq" ON "dilemma_answers" USING btree ("dilemma_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_life_season_uniq" ON "life_snapshots" USING btree ("life_id","season_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_idem_uniq" ON "life_snapshots" USING btree ("life_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_life_idx" ON "life_snapshots" USING btree ("life_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lives_user_slot_uniq" ON "lives" USING btree ("user_id","slot_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lives_user_idx" ON "lives" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "results_life_season_uniq" ON "season_results" USING btree ("life_id","season_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "results_season_idx" ON "season_results" USING btree ("season_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "results_season_index_idx" ON "season_results" USING btree ("season_number","life_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "share_life_idx" ON "share_tokens" USING btree ("life_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_characters_uniq" ON "user_characters" USING btree ("user_id","character_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_endings_uniq" ON "user_endings" USING btree ("user_id","ending_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_cards_uniq" ON "user_knowledge_cards" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_provider_uniq" ON "users" USING btree ("provider","provider_id");