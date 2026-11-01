import { AIMessageChunk } from "@langchain/core/messages";
import type { Assistant } from "./assistant.ts";

export type ReplyEvent =
  | { type: "tool"; name: string }
  | { type: "text"; text: string };

export async function* streamReply(
  assistant: Assistant,
  message: string,
  threadId: string,
  signal: AbortSignal,
): AsyncGenerator<ReplyEvent> {
  const stream = await assistant.stream(
    { messages: [{ role: "user", content: message }] },
    { configurable: { thread_id: threadId }, streamMode: "messages", signal },
  );

  for await (const [chunk] of stream) {
    if (!AIMessageChunk.isInstance(chunk)) continue;

    for (const toolCall of chunk.tool_call_chunks ?? [])
      if (toolCall.name) yield { type: "tool", name: toolCall.name };

    if (chunk.text) yield { type: "text", text: chunk.text };
  }
}
