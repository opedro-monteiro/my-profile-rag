export type ModelProvider = "ollama" | "openrouter"

export interface ModelOption {
  id: string
  provider: ModelProvider
  label: string
  description: string
  contextWindow: number
  supportsThinking?: boolean
  locked?: boolean
}

/**
 * Models offered in the chat model picker. Edit this list by hand: `id` is
 * the name the provider expects (`ollama list` or the OpenRouter slug).
 * OpenRouter models only work when the API has OPENROUTER_API_KEY set.
 * `locked` models are listed but cannot be picked; remove the flag to enable.
 */
export const MODELS: ModelOption[] = [
  {
    id: "gemma4:e2b",
    provider: "ollama",
    label: "Gemma 4 E2B",
    description: "Local on the desktop. The default.",
    contextWindow: 128_000,
  },
  {
    id: "glm-4.7-flash:latest",
    provider: "ollama",
    label: "GLM 4.7 Flash",
    description: "Local and fast.",
    contextWindow: 128_000,
    supportsThinking: true,
    locked: true,
  },
  {
    id: "qwen2.5-coder:14b",
    provider: "ollama",
    label: "Qwen 2.5 Coder 14B",
    description: "Local, larger and slower.",
    contextWindow: 32_000,
    locked: true,
  },
  {
    id: "qwen2.5-coder:7b",
    provider: "ollama",
    label: "Qwen 2.5 Coder 7B",
    description: "Local and lightweight.",
    contextWindow: 32_000,
    locked: true,
  },
  {
    id: "z-ai/glm-5.3-flash",
    provider: "openrouter",
    label: "GLM 5.3 Flash",
    description: "Hosted on OpenRouter.",
    contextWindow: 200_000,
    supportsThinking: true,
    locked: true,
  },
]

export const DEFAULT_MODEL = MODELS.find((model) => !model.locked) ?? MODELS[0]

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  ollama: "Ollama · local",
  openrouter: "OpenRouter · cloud",
}

export function modelLabel(id: string) {
  return MODELS.find((model) => model.id === id)?.label ?? id
}

/** The model to use for a saved choice, falling back when it is locked or gone. */
export function resolveModel(id: string | undefined): ModelOption {
  const model = MODELS.find((item) => item.id === id)
  return model && !model.locked ? model : DEFAULT_MODEL
}
