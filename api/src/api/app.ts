import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyBaseLogger } from "fastify";
import type { ReplyEvent } from "../agent/stream-reply.ts";
import type { ModelSelection } from "../infra/chat-model.ts";
import { modelKey } from "../infra/model-key.ts";
import { trackUsage } from "../usage/track-usage.ts";
import type { UsageStore } from "../usage/usage-store.ts";
import { describeReplyError } from "./describe-reply-error.ts";

const DAY_MS = 86_400_000;
const RANGE_DAYS = { "7d": 7, "30d": 30 } as const;

type UsageRange = keyof typeof RANGE_DAYS | "all";

export interface ReplyRequest {
  message: string;
  threadId: string;
  model?: ModelSelection;
}

export type ReplyStreamer = (
  request: ReplyRequest,
  signal: AbortSignal,
) => AsyncIterable<ReplyEvent>;

export interface ToolDescriptor {
  name: string;
  description: string;
  parameters: unknown;
}

export interface AppOptions {
  corsOrigin: string | string[];
  streamReply: ReplyStreamer;
  allowedModels?: string[];
  trustProxy?: number;
  chatRateLimit?: { max: number; timeWindow: number };
  tools?: ToolDescriptor[];
  logger?: boolean;
  usage?: {
    store: UsageStore;
    defaultModel: ModelSelection;
  };
}

interface ChatBody {
  message: string;
  threadId?: string;
  model?: ModelSelection;
}

const chatBodySchema = {
  type: "object",
  required: ["message"],
  additionalProperties: false,
  properties: {
    message: { type: "string", pattern: "\\S", maxLength: 4000 },
    threadId: { type: "string", format: "uuid" },
    model: {
      type: "object",
      required: ["provider", "model"],
      additionalProperties: false,
      properties: {
        provider: { type: "string", enum: ["ollama", "openrouter"] },
        model: { type: "string", pattern: "^[\\w.:/@-]{1,128}$" },
        think: { type: "boolean" },
      },
    },
  },
};

const usageQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    range: { type: "string", enum: ["7d", "30d", "all"], default: "7d" },
  },
};

function toSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function* streamAsSse(
  replies: AsyncIterable<ReplyEvent>,
  threadId: string,
  signal: AbortSignal,
  log: FastifyBaseLogger,
): AsyncGenerator<string> {
  yield toSse("start", { threadId });

  try {
    for await (const { type, ...data } of replies) yield toSse(type, data);

    yield toSse("done", {});
  } catch (error) {
    if (signal.aborted) return;

    log.error(error);
    yield toSse("error", { message: describeReplyError(error) });
  }
}

export async function buildApp({
  corsOrigin,
  streamReply,
  tools = [],
  logger = false,
  usage,
  allowedModels,
  trustProxy = 0,
  chatRateLimit,
}: AppOptions) {
  const app = Fastify({
    logger,
    trustProxy: (_address, hop) => hop < trustProxy,
    forceCloseConnections: true,
  });

  await app.register(cors, { origin: corsOrigin, methods: ["GET", "POST"] });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      message: "Muitas mensagens em pouco tempo. Aguarde um minuto.",
    }),
  });

  app.get("/health", () => ({ status: "ok" }));

  app.get("/api/tools", () => ({ tools }));

  if (usage)
    app.get<{ Querystring: { range: UsageRange } }>(
      "/api/usage",
      { schema: { querystring: usageQuerySchema } },
      async (request) => {
        const { range } = request.query;
        const since =
          range === "all"
            ? undefined
            : new Date(Date.now() - RANGE_DAYS[range] * DAY_MS);

        return { records: await usage.store.list(since) };
      },
    );

  app.post<{ Body: ChatBody }>(
    "/api/chat/stream",
    {
      schema: { body: chatBodySchema },
      config: chatRateLimit ? { rateLimit: chatRateLimit } : {},
    },
    (request, reply) => {
      const { message, threadId = randomUUID(), model } = request.body;

      if (model && allowedModels && !allowedModels.includes(modelKey(model)))
        return reply.code(400).send({ message: "Modelo não disponível." });

      const disconnect = new AbortController();
      reply.raw.once("close", () => disconnect.abort());

      let replies = streamReply(
        { message: message.trim(), threadId, model },
        disconnect.signal,
      );

      if (usage)
        replies = trackUsage(replies, {
          threadId,
          model: model ?? usage.defaultModel,
          signal: disconnect.signal,
          onFinish: (record) =>
            usage.store
              .record(record)
              .catch((error) => request.log.error(error, "usage not saved")),
        });
      const events = streamAsSse(
        replies,
        threadId,
        disconnect.signal,
        request.log,
      );

      return reply
        .header("content-type", "text/event-stream; charset=utf-8")
        .header("cache-control", "no-cache")
        .header("x-accel-buffering", "no")
        .send(Readable.from(events));
    },
  );

  return app;
}
