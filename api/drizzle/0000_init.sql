CREATE TYPE "public"."reply_status" AS ENUM('done', 'error', 'stopped');--> statement-breakpoint
CREATE TABLE "chat_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" "reply_status" NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"model_calls" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reply_id" uuid NOT NULL,
	"call_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_reply_id_chat_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."chat_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_replies_created_at_idx" ON "chat_replies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_replies_thread_id_idx" ON "chat_replies" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "tool_calls_reply_id_idx" ON "tool_calls" USING btree ("reply_id");