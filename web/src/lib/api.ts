import type { ModelOption } from "@/config/models"
import { readErrorMessage } from "@/lib/read-error-message"

export const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3333"

export interface ToolDescriptor {
  name: string
  description: string
  parameters: {
    properties?: Record<string, { type?: string; description?: string }>
    required?: string[]
  }
}

export async function fetchTools(signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/api/tools`, { signal })
  if (!response.ok)
    throw new Error(`Request failed with status ${response.status}`)

  const body = (await response.json()) as { tools: ToolDescriptor[] }
  return body.tools
}

export interface StreamChatInput {
  message: string
  threadId?: string
  model: ModelOption
  think: boolean
  turnstileToken?: string
  signal: AbortSignal
}

export async function postChatStream({
  message,
  threadId,
  model,
  think,
  turnstileToken,
  signal,
}: StreamChatInput) {
  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(turnstileToken && { "x-turnstile-token": turnstileToken }),
    },
    body: JSON.stringify({
      message,
      threadId,
      model: { provider: model.provider, model: model.id, think },
    }),
    signal,
  })

  if (!response.ok || !response.body)
    throw new Error(await readErrorMessage(response))

  return response.body
}

export type UsageRange = "7d" | "30d" | "all"

/** One assistant reply, as recorded by the API in Postgres. */
export interface UsageRecord {
  at: number
  modelId: string
  provider: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  durationMs: number
  tools: string[]
  status: "done" | "error" | "stopped"
}

export async function fetchUsage(range: UsageRange, signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/api/usage?range=${range}`, {
    signal,
  })
  if (!response.ok)
    throw new Error(`Request failed with status ${response.status}`)

  const body = (await response.json()) as { records: UsageRecord[] }
  return body.records
}
