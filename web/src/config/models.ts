export type ModelProvider = "ollama" | "openrouter"

export interface ModelOption {
  id: string
  provider: ModelProvider
  label: string
  description: string
  contextWindow: number
  supportsThinking?: boolean
}

/**
 * Models offered in the chat model picker. Edit this list by hand: `id` is
 * the name the provider expects (`ollama list` or the OpenRouter slug).
 * OpenRouter models only work when the API has OPENROUTER_API_KEY set.
 */
export const MODELS: ModelOption[] = [
  {
    id: "glm-4.7-flash:latest",
    provider: "ollama",
    label: "GLM 4.7 Flash",
    description: "Local and fast. The default.",
    contextWindow: 128_000,
    supportsThinking: true,
  },
  {
    id: "qwen2.5-coder:14b",
    provider: "ollama",
    label: "Qwen 2.5 Coder 14B",
    description: "Local, larger and slower.",
    contextWindow: 32_000,
  },
  {
    id: "qwen2.5-coder:7b",
    provider: "ollama",
    label: "Qwen 2.5 Coder 7B",
    description: "Local and lightweight.",
    contextWindow: 32_000,
  },
  {
    id: "z-ai/glm-5.3-flash",
    provider: "openrouter",
    label: "GLM 5.3 Flash",
    description: "Hosted on OpenRouter.",
    contextWindow: 200_000,
    supportsThinking: true,
  },
]

export const DEFAULT_MODEL = MODELS[0]

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  ollama: "Ollama · local",
  openrouter: "OpenRouter · cloud",
}

export function findModel(id: string | undefined): ModelOption {
  return MODELS.find((model) => model.id === id) ?? DEFAULT_MODEL
}
