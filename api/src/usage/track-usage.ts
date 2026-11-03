import type { ReplyEvent } from "../agent/stream-reply.ts";
import type { ModelSelection } from "../infra/chat-model.ts";

export type ReplyStatus = "done" | "error" | "stopped";
export type ToolCallStatus = "success" | "error" | "unfinished";

export interface ReplyUsage {
  threadId: string;
  provider: string;
  model: string;
  status: ReplyStatus;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  modelCalls: number;
  durationMs: number;
  tools: { callId: string; name: string; status: ToolCallStatus }[];
}

export interface TrackOptions {
  threadId: string;
  model: ModelSelection;
  signal: AbortSignal;
  onFinish: (usage: ReplyUsage) => void;
}

/**
 * Passes reply events through unchanged and reports the reply's token usage
 * and tool calls once the stream ends, however it ends.
 */
export async function* trackUsage(
  events: AsyncIterable<ReplyEvent>,
  { threadId, model, signal, onFinish }: TrackOptions,
): AsyncGenerator<ReplyEvent> {
  const startedAt = performance.now();
  const tools = new Map<string, ReplyUsage["tools"][number]>();
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let modelCalls = 0;
  let failed = false;

  try {
    for await (const event of events) {
      if (event.type === "usage") {
        inputTokens += event.inputTokens;
        outputTokens += event.outputTokens;
        totalTokens += event.totalTokens;
        modelCalls++;
      }

      const isToolStart = event.type === "tool" || event.type === "tool_input";
      if (isToolStart && !tools.has(event.id))
        tools.set(event.id, {
          callId: event.id,
          name: event.name,
          status: "unfinished",
        });

      if (event.type === "tool_result")
        tools.set(event.id, {
          callId: event.id,
          name: event.name || (tools.get(event.id)?.name ?? ""),
          status: event.status,
        });

      yield event;
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    onFinish({
      threadId,
      provider: model.provider,
      model: model.model,
      status: signal.aborted ? "stopped" : failed ? "error" : "done",
      inputTokens,
      outputTokens,
      totalTokens,
      modelCalls,
      durationMs: Math.round(performance.now() - startedAt),
      tools: [...tools.values()],
    });
  }
}
