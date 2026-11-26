import * as z from "zod";
import { createAssistantPool } from "../agent/assistant.ts";
import { streamReply } from "../agent/stream-reply.ts";
import { buildApp } from "../api/app.ts";
import { getConfig } from "../config/index.ts";
import { MODEL_CATALOG } from "../config/models.ts";
import { defaultModelSelection } from "../infra/chat-model.ts";
import {
  createModelCatalog,
  ollamaChecker,
  openRouterModelsFetcher,
} from "../infra/model-catalog.ts";
import { createAccessCheck } from "../api/access.ts";
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
  const { api, llm } = getConfig();
  const { host, port, corsOrigin, accessTokens } = api;

  await getVectorStore();
  const getAssistant = createAssistantPool();
  getAssistant();

  const app = await buildApp({
    corsOrigin,
    logger: true,
    tools: describeTools(),
    hasAccess: createAccessCheck(accessTokens),
    models: createModelCatalog({
      entries: MODEL_CATALOG,
      defaultModel: defaultModelSelection(),
      hasOpenRouterKey: Boolean(llm.openRouter.apiKey),
      fetchOpenRouterModels: openRouterModelsFetcher(llm.openRouter.baseUrl),
      checkOllama: ollamaChecker(llm.ollama.baseUrl),
      onFetchError: (error) =>
        app.log.warn({ err: error }, "could not list OpenRouter models"),
    }),
    streamReply: ({ message, threadId, model }, signal) =>
      streamReply(getAssistant(model), message, threadId, signal),
  });

  const shutdown = async () => {
    await app.close();
    await closeVectorStore();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (accessTokens.length === 0)
    app.log.warn("ACCESS_TOKENS is empty: OpenRouter models are locked for everyone");

  await app.listen({ host, port });
}

try {
  await start();
} catch (error) {
  console.error(`❌ ${describeFatalError(error)}`);
  process.exit(1);
}
