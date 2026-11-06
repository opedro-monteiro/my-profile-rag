import * as z from "zod";
import { createAssistantPool } from "../agent/assistant.ts";
import { streamReply } from "../agent/stream-reply.ts";
import { buildApp } from "../api/app.ts";
import { createTurnstileVerifier } from "../api/verify-turnstile.ts";
import { getConfig } from "../config/index.ts";
import { defaultModelSelection } from "../infra/chat-model.ts";
import { modelKey } from "../infra/model-key.ts";
import {
  checkDatabase,
  closeDatabase,
  getDatabase,
} from "../infra/database.ts";
import { runMigrations } from "../infra/run-migrations.ts";
import { closeVectorStore, getVectorStore } from "../infra/vector-store.ts";
import { tools } from "../tools/index.ts";
import { createUsageStore } from "../usage/usage-store.ts";
import { describeFatalError } from "./fatal-error.ts";

function describeTools() {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.schema as z.ZodType),
  }));
}

async function start(): Promise<void> {
  const {
    host,
    port,
    corsOrigin,
    allowedModels,
    trustProxy,
    chatRateLimit,
    turnstile,
  } = getConfig().api;
  const defaultModel = defaultModelSelection();

  await getVectorStore();
  await runMigrations();
  await checkDatabase();
  const getAssistant = createAssistantPool();
  getAssistant();

  const app = await buildApp({
    corsOrigin,
    allowedModels: allowedModels.length
      ? allowedModels
      : [modelKey(defaultModel)],
    trustProxy,
    chatRateLimit,
    verifyHuman: turnstile && createTurnstileVerifier(turnstile),
    logger: true,
    tools: describeTools(),
    usage: {
      store: createUsageStore(getDatabase()),
      defaultModel,
    },
    streamReply: ({ message, threadId, model }, signal) =>
      streamReply(getAssistant(model), message, threadId, signal),
  });

  const shutdown = async () => {
    await app.close();
    await closeVectorStore();
    await closeDatabase();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (!turnstile)
    app.log.warn("Turnstile disabled: set TURNSTILE_SECRET and TURNSTILE_HOSTNAMES");

  await app.listen({ host, port });
}

try {
  await start();
} catch (error) {
  console.error(`❌ ${describeFatalError(error)}`);
  process.exit(1);
}
