import type { ModelOption } from "@/config/models"

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
  signal: AbortSignal
}

export async function postChatStream({
  message,
  threadId,
  model,
  think,
  signal,
}: StreamChatInput) {
  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      threadId,
      model: { provider: model.provider, model: model.id, think },
    }),
    signal,
  })

  if (!response.ok || !response.body)
    throw new Error(`Request failed with status ${response.status}`)

  return response.body
}
