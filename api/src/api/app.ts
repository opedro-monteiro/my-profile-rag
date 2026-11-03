import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import cors from "@fastify/cors";
import Fastify, { type FastifyBaseLogger } from "fastify";
import type { ReplyEvent } from "../agent/stream-reply.ts";
import {
  ModelUnavailableError,
  type ModelSelection,
} from "../infra/chat-model.ts";

const GENERIC_ERROR_MESSAGE = "Erro ao gerar a resposta.";

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
  corsOrigin: string;
  streamReply: ReplyStreamer;
  tools?: ToolDescriptor[];
  logger?: boolean;
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
    const message =
      error instanceof ModelUnavailableError
        ? error.message
        : GENERIC_ERROR_MESSAGE;
    yield toSse("error", { message });
  }
}

export async function buildApp({
  corsOrigin,
  streamReply,
  tools = [],
  logger = false,
}: AppOptions) {
  const app = Fastify({ logger, forceCloseConnections: true });

  await app.register(cors, { origin: corsOrigin, methods: ["GET", "POST"] });

  app.get("/api/tools", () => ({ tools }));

  app.post<{ Body: ChatBody }>(
    "/api/chat/stream",
    { schema: { body: chatBodySchema } },
    (request, reply) => {
      const { message, threadId = randomUUID(), model } = request.body;

      const disconnect = new AbortController();
      reply.raw.once("close", () => disconnect.abort());

      const replies = streamReply(
        { message: message.trim(), threadId, model },
        disconnect.signal,
      );
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
