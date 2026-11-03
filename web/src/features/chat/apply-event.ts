import type { AssistantMessage, Step, ToolStep } from "./types"

export class StreamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StreamError"
  }
}

function closeReasoning(steps: Step[], now: number): Step[] {
  const last = steps.at(-1)
  if (last?.kind !== "reasoning" || last.endedAt) return steps

  return [...steps.slice(0, -1), { ...last, endedAt: now }]
}

function upsertTool(
  steps: Step[],
  id: string,
  name: string,
  now: number,
  update: (step: ToolStep) => ToolStep
): Step[] {
  const index = steps.findIndex(
    (step) => step.kind === "tool" && step.id === id
  )

  if (index === -1) {
    const created: ToolStep = {
      kind: "tool",
      id,
      name,
      status: "running",
      startedAt: now,
    }
    return [...closeReasoning(steps, now), update(created)]
  }

  return steps.map((step, position) =>
    position === index ? update(step as ToolStep) : step
  )
}

/** Folds one server-sent event into the assistant message it belongs to. */
export function applyEvent(
  message: AssistantMessage,
  event: string,
  payload: Record<string, unknown>,
  now = Date.now()
): AssistantMessage {
  const id = String(payload.id ?? payload.name ?? "")
  const name = String(payload.name ?? "")

  switch (event) {
    case "reasoning": {
      const text = String(payload.text ?? "")
      const last = message.steps.at(-1)

      if (last?.kind === "reasoning" && !last.endedAt)
        return {
          ...message,
          steps: [
            ...message.steps.slice(0, -1),
            { ...last, text: last.text + text },
          ],
        }

      return {
        ...message,
        steps: [
          ...message.steps,
          { kind: "reasoning", id: crypto.randomUUID(), text, startedAt: now },
        ],
      }
    }

    case "tool":
      return {
        ...message,
        steps: upsertTool(message.steps, id, name, now, (step) => step),
      }

    case "tool_input":
      return {
        ...message,
        steps: upsertTool(message.steps, id, name, now, (step) => ({
          ...step,
          input: payload.input as Record<string, unknown>,
        })),
      }

    case "tool_result":
      return {
        ...message,
        steps: upsertTool(message.steps, id, name, now, (step) => ({
          ...step,
          output: String(payload.output ?? ""),
          status: payload.status === "error" ? "error" : "success",
          endedAt: now,
        })),
      }

    case "text":
      return {
        ...message,
        steps: closeReasoning(message.steps, now),
        content: message.content + String(payload.text ?? ""),
      }

    case "usage": {
      const inputTokens = Number(payload.inputTokens ?? 0)
      const outputTokens = Number(payload.outputTokens ?? 0)
      const previous = message.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      }
      return {
        ...message,
        contextTokens: inputTokens + outputTokens,
        usage: {
          inputTokens: previous.inputTokens + inputTokens,
          outputTokens: previous.outputTokens + outputTokens,
          totalTokens:
            previous.totalTokens +
            Number(payload.totalTokens ?? inputTokens + outputTokens),
        },
      }
    }

    case "error":
      throw new StreamError(String(payload.message ?? "Something went wrong."))

    default:
      return message
  }
}

/** Marks every step still running as finished, with the given outcome. */
export function settleSteps(
  message: AssistantMessage,
  now: number,
  failed: boolean
): AssistantMessage {
  return {
    ...message,
    steps: message.steps.map((step) => {
      if (step.endedAt) return step
      if (step.kind === "reasoning") return { ...step, endedAt: now }

      return { ...step, status: failed ? "error" : "success", endedAt: now }
    }),
  }
}
