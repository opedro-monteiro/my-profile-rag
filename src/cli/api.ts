import { createAssistant } from "../agent/assistant.ts";
import { streamReply } from "../agent/stream-reply.ts";
import { buildApp } from "../api/app.ts";
import { getConfig } from "../config/index.ts";
import { closeVectorStore, getVectorStore } from "../infra/vector-store.ts";
import { describeFatalError } from "./fatal-error.ts";

async function start(): Promise<void> {
  const { host, port, corsOrigin } = getConfig().api;

  await getVectorStore();
  const assistant = createAssistant();

  const app = await buildApp({
    corsOrigin,
    logger: true,
    streamReply: (message, threadId, signal) =>
      streamReply(assistant, message, threadId, signal),
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
