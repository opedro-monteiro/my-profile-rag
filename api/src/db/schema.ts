import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const replyStatus = pgEnum("reply_status", ["done", "error", "stopped"]);

/** One row per assistant reply, written when its stream ends. */
export const chatReplies = pgTable(
  "chat_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: replyStatus("status").notNull(),
    /** Summed over every model call in the reply (one before and one after each tool round). */
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    modelCalls: integer("model_calls").notNull().default(0),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_replies_created_at_idx").on(table.createdAt),
    index("chat_replies_thread_id_idx").on(table.threadId),
  ],
);

/** One row per tool the agent called while producing a reply. */
export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    replyId: uuid("reply_id")
      .notNull()
      .references(() => chatReplies.id, { onDelete: "cascade" }),
    callId: text("call_id").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["success", "error", "unfinished"] })
      .notNull(),
  },
  (table) => [index("tool_calls_reply_id_idx").on(table.replyId)],
);
