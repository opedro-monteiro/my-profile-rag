import { desc, eq, gte, sql } from "drizzle-orm";
import { chatReplies, toolCalls } from "../db/schema.ts";
import type { Database } from "../infra/database.ts";
import type { ReplyStatus, ReplyUsage } from "./track-usage.ts";

/** The shape the web dashboard aggregates. */
export interface UsageRecord {
  at: number;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  tools: string[];
  status: ReplyStatus;
}

export interface UsageStore {
  record(usage: ReplyUsage): Promise<void>;
  list(since?: Date): Promise<UsageRecord[]>;
}

export function createUsageStore(db: Database): UsageStore {
  return {
    async record({ tools, ...reply }) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(chatReplies)
          .values(reply)
          .returning({ id: chatReplies.id });

        if (tools.length)
          await tx
            .insert(toolCalls)
            .values(tools.map((tool) => ({ ...tool, replyId: row.id })));
      });
    },

    async list(since) {
      const rows = await db
        .select({
          createdAt: chatReplies.createdAt,
          model: chatReplies.model,
          provider: chatReplies.provider,
          inputTokens: chatReplies.inputTokens,
          outputTokens: chatReplies.outputTokens,
          totalTokens: chatReplies.totalTokens,
          durationMs: chatReplies.durationMs,
          status: chatReplies.status,
          tools: sql<string[]>`coalesce(array_agg(${toolCalls.name}) filter (where ${toolCalls.name} is not null), '{}')`,
        })
        .from(chatReplies)
        .leftJoin(toolCalls, eq(toolCalls.replyId, chatReplies.id))
        .where(since ? gte(chatReplies.createdAt, since) : undefined)
        .groupBy(chatReplies.id)
        .orderBy(desc(chatReplies.createdAt));

      return rows.map(({ createdAt, model, ...row }) => ({
        ...row,
        at: createdAt.getTime(),
        modelId: model,
      }));
    },
  };
}
