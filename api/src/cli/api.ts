import * as z from "zod";
import { createAssistantPool } from "../agent/assistant.ts";
import { streamReply } from "../agent/stream-reply.ts";
import { buildApp } from "../api/app.ts";
import { getConfig } from "../config/index.ts";
import { closeVectorStore, getVectorStore } from "../infra/vector-store.ts";
import { tools } from "../tools/index.ts";
import { describeFatalError } from "./fatal-error.ts";

function describeTools() {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.schema as z.ZodType),
  }));
}

async function start(): Promise<void> {
  const { host, port, corsOrigin } = getConfig().api;

  await getVectorStore();
  const getAssistant = createAssistantPool();
  getAssistant();

  const app = await buildApp({
    corsOrigin,
    logger: true,
    tools: describeTools(),
    streamReply: ({ message, threadId, model }, signal) =>
      streamReply(getAssistant(model), message, threadId, signal),
  });

  const shutdown = async () => {
    await app.close();
    await closeVectorStore();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await app.listen({ host, port });
}

try {
  await start();
} catch (error) {
  console.error(`❌ ${describeFatalError(error)}`);
  process.exit(1);
}
