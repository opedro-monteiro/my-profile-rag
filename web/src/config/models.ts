export type ModelProvider = "ollama" | "openrouter"

export type UnavailableReason =
  "disabled" | "missing_api_key" | "not_on_openrouter"

/**
 * A model the API offers. The list comes from `GET /api/models`; to change
 * which models appear, edit `api/src/config/models.ts`.
 */
export interface ModelOption {
  id: string
  provider: ModelProvider
  label: string
  description: string
  /** Null when the API could not learn it from OpenRouter. */
  contextWindow: number | null
  supportsThinking: boolean
  locked: boolean
  unavailableReason?: UnavailableReason
}

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  ollama: "Ollama · local",
  openrouter: "OpenRouter · cloud",
}

export const UNAVAILABLE_REASONS: Record<UnavailableReason, string> = {
  disabled: "Turned off in the API's model list",
  token_required: "Open the link Pedro sent you to use it",
  missing_api_key: "Set OPENROUTER_API_KEY in the API to use it",
  not_on_openrouter: "OpenRouter doesn't list this model id",
  ollama_offline: "Pedro's computer is offline",
}

/** The model to use for a saved choice, falling back when it is locked or gone. */
export function resolveModel(
  models: ModelOption[],
  id: string | undefined,
  defaultId: string | undefined
): ModelOption | null {
  const usable = (modelId: string | undefined) =>
    models.find((item) => item.id === modelId && !item.locked)

  return (
    usable(id) ??
    usable(defaultId) ??
    models.find((item) => !item.locked) ??
    null
  )
}
