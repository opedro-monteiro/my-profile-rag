import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createAssistant, type Assistant } from "../agent/assistant.ts";
import { streamReply } from "../agent/stream-reply.ts";
import { closeVectorStore, getVectorStore } from "../infra/vector-store.ts";
import { describeFatalError } from "./fatal-error.ts";

const PROMPT = "\nVocê > ";

async function printReply(
  assistant: Assistant,
  message: string,
  threadId: string,
  signal: AbortSignal,
): Promise<void> {
  let isWritingReply = false;

  for await (const event of streamReply(assistant, message, threadId, signal)) {
    if (event.type === "tool") {
      output.write(`\n🔎 Usando ${event.name}...\n`);
      continue;
    }

    if (event.type !== "text") continue;

    if (!isWritingReply) output.write("\nAssistente > ");
    isWritingReply = true;
    output.write(event.text);
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
        await printReply(assistant, message, threadId, shutdown.signal);
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
