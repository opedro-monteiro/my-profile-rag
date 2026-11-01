import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AIMessageChunk } from "@langchain/core/messages";
import { createAssistant, type Assistant } from "../agent/assistant.ts";
import { InvalidEnvError } from "../config/env.ts";
import {
  closeVectorStore,
  getVectorStore,
  VectorIndexNotFoundError,
} from "../infra/vector-store.ts";

const PROMPT = "\nVocê > ";

function describeFatalError(error: unknown): string {
  if (error instanceof InvalidEnvError) return error.message;
  if (error instanceof VectorIndexNotFoundError)
    return `${error.message}. Rode "npm run seed" antes de conversar.`;

  const detail = error instanceof Error ? error.message : String(error);
  return `Não foi possível iniciar o chat: ${detail}\nVerifique se o Neo4j está no ar com "npm run infra:up".`;
}

async function streamReply(
  assistant: Assistant,
  message: string,
  threadId: string,
  signal: AbortSignal,
): Promise<void> {
  const stream = await assistant.stream(
    { messages: [{ role: "user", content: message }] },
    { configurable: { thread_id: threadId }, streamMode: "messages", signal },
  );

  let isWritingReply = false;

  for await (const [chunk] of stream) {
    if (!AIMessageChunk.isInstance(chunk)) continue;

    for (const toolCall of chunk.tool_call_chunks ?? [])
      if (toolCall.name) output.write(`\n🔎 Usando ${toolCall.name}...\n`);

    if (!chunk.text) continue;

    if (!isWritingReply) output.write("\nAssistente > ");
    isWritingReply = true;
    output.write(chunk.text);
  }

  output.write("\n");
}

async function runChat(assistant: Assistant): Promise<void> {
  const readline = createInterface({ input, output, prompt: PROMPT });
  const shutdown = new AbortController();
  let threadId = randomUUID();

  const stop = () => {
    shutdown.abort();
    readline.close();
  };
  readline.on("SIGINT", stop);
  process.once("SIGINT", stop);

  output.write('Assistente pronto. Comandos: /clear e /exit.\n');
  readline.prompt();

  for await (const line of readline) {
    const message = line.trim();

    if (message === "/exit") break;

    if (message === "/clear") {
      threadId = randomUUID();
      output.write("Conversa reiniciada.\n");
    } else if (message) {
      try {
        await streamReply(assistant, message, threadId, shutdown.signal);
      } catch (error) {
        if (shutdown.signal.aborted) break;

        const detail = error instanceof Error ? error.message : String(error);
        console.error(`\n❌ Erro ao responder: ${detail}`);
      }
    }

    readline.prompt();
  }

  readline.close();
  process.off("SIGINT", stop);
}

try {
  await getVectorStore();
  await runChat(createAssistant());
  await closeVectorStore();
} catch (error) {
  console.error(`❌ ${describeFatalError(error)}`);
  process.exit(1);
}
