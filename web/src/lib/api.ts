import type {
  ModelOption,
  ModelProvider,
  UnavailableReason,
} from "@/config/models"

import { accessHeaders } from "@/lib/access"

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

interface ModelDescriptor {
  provider: ModelProvider
  id: string
  label: string
  description: string
  contextWindow: number | null
  supportsThinking: boolean
  available: boolean
  unavailableReason?: UnavailableReason
}

export interface ModelList {
  models: ModelOption[]
  defaultId: string
  /** "full" when the saved access token unlocked OpenRouter. */
  access: "full" | "local"
}

/** Uses the API's own message (it is written for people) when it sends one. */
async function requestError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown
  } | null
  return new Error(
    typeof body?.message === "string"
      ? body.message
      : `Request failed with status ${response.status}`
  )
}

export async function fetchModels(signal?: AbortSignal): Promise<ModelList> {
  const response = await fetch(`${API_URL}/api/models`, {
    headers: accessHeaders(),
    signal,
  })
  if (!response.ok) throw await requestError(response)

  const body = (await response.json()) as {
    models: ModelDescriptor[]
    default: { provider: ModelProvider; model: string }
    access: "full" | "local"
  }

  return {
    models: body.models.map(({ available, ...model }) => ({
      ...model,
      locked: !available,
    })),
    defaultId: body.default.model,
    access: body.access,
  }
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
    headers: { "content-type": "application/json", ...accessHeaders() },
    body: JSON.stringify({
      message,
      threadId,
      model: { provider: model.provider, model: model.id, think },
    }),
    signal,
  })

  if (!response.ok) throw await requestError(response)
  if (!response.body) throw new Error("The API sent an empty reply.")

  return response.body
}
