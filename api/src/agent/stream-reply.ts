import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { Assistant } from "./assistant.ts";

export type ReplyEvent =
  | { type: "tool"; id: string; name: string }
  | { type: "tool_input"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      id: string;
      name: string;
      output: string;
      status: "success" | "error";
    }
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };

function readReasoning(chunk: AIMessageChunk): string {
  const reasoning = chunk.additional_kwargs?.reasoning_content;
  return typeof reasoning === "string" ? reasoning : "";
}

function stringifyContent(content: ToolMessage["content"]): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function* fromUpdate(messages: BaseMessage[]): Generator<ReplyEvent> {
  for (const message of messages) {
    if (AIMessage.isInstance(message)) {
      for (const call of message.tool_calls ?? [])
        yield {
          type: "tool_input",
          id: call.id ?? call.name,
          name: call.name,
          input: call.args,
        };

      const usage = message.usage_metadata;
      if (usage)
        yield {
          type: "usage",
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          totalTokens: usage.total_tokens,
        };
    }

    if (ToolMessage.isInstance(message))
      yield {
        type: "tool_result",
        id: message.tool_call_id,
        name: message.name ?? "",
        output: stringifyContent(message.content),
        status: message.status === "error" ? "error" : "success",
      };
  }
}

export async function* streamReply(
  assistant: Assistant,
  message: string,
  threadId: string,
  signal: AbortSignal,
): AsyncGenerator<ReplyEvent> {
  const stream = await assistant.stream(
    { messages: [{ role: "user", content: message }] },
    {
      configurable: { thread_id: threadId },
      streamMode: ["messages", "updates"],
      signal,
    },
  );

  for await (const [mode, payload] of stream) {
    if (mode === "updates") {
      for (const update of Object.values(payload ?? {})) {
        const messages = (update as { messages?: BaseMessage[] } | undefined)
          ?.messages;
        if (Array.isArray(messages)) yield* fromUpdate(messages);
      }
      continue;
    }

    const [chunk] = payload as [BaseMessage, unknown];
    if (!AIMessageChunk.isInstance(chunk)) continue;

    for (const toolCall of chunk.tool_call_chunks ?? [])
      if (toolCall.name)
        yield {
          type: "tool",
          id: toolCall.id ?? toolCall.name,
          name: toolCall.name,
        };

    const reasoning = readReasoning(chunk);
    if (reasoning) yield { type: "reasoning", text: reasoning };

    if (chunk.text) yield { type: "text", text: chunk.text };
  }
}
