import type { LlmProvider } from "../infra/chat-model.ts";

export interface CatalogEntry {
  provider: LlmProvider;
  /** The name the provider expects: `ollama list` or the OpenRouter slug. */
  id: string;
  /** For OpenRouter, defaults to the name OpenRouter gives the model. */
  label?: string;
  description?: string;
  /** Required for Ollama. For OpenRouter, read from its catalogue. */
  contextWindow?: number;
  /** For OpenRouter, read from its catalogue (the `reasoning` parameter). */
  supportsThinking?: boolean;
  /** `false` lists the model in the picker but greyed out. Defaults to true. */
  enabled?: boolean;
}

/**
 * The models the web picker offers and the API accepts. This list is the
 * allowlist: a request for any other model is rejected. OpenRouter entries
 * are matched against https://openrouter.ai/api/v1/models, which fills in
 * their name, context window and thinking support.
 */
export const MODEL_CATALOG: readonly CatalogEntry[] = [
  {
    provider: "ollama",
    id: "gemma4:e2b",
    label: "Gemma 4 E2B",
    description: "Local on the desktop. The default.",
    contextWindow: 128_000,
  },
  {
    provider: "ollama",
    id: "glm-4.7-flash:latest",
    label: "GLM 4.7 Flash",
    description: "Local and fast.",
    contextWindow: 128_000,
    supportsThinking: true,
    enabled: false,
  },
  {
    provider: "ollama",
    id: "qwen2.5-coder:14b",
    label: "Qwen 2.5 Coder 14B",
    description: "Local, larger and slower.",
    contextWindow: 32_000,
    enabled: false,
  },
  {
    provider: "ollama",
    id: "qwen2.5-coder:7b",
    label: "Qwen 2.5 Coder 7B",
    description: "Local and lightweight.",
    contextWindow: 32_000,
    enabled: false,
  },
  // OpenRouter. The slugs are best guesses: one OpenRouter doesn't list
  // shows as locked ("not_on_openrouter") in GET /api/models; fix its id.
  {
    provider: "openrouter",
    id: "anthropic/claude-haiku-5.5",
    description: "Reliable with tools and instructions.",
  },
  {
    provider: "openrouter",
    id: "deepseek/deepseek-v4.1-flash",
    description: "Very cheap, good in Portuguese.",
  },
  {
    provider: "openrouter",
    id: "z-ai/glm-5.3-flash",
    description: "Cheap, with thinking.",
  },
  {
    provider: "openrouter",
    id: "openai/gpt-oss-20b",
    description: "The cheapest with tool calling.",
  },
  {
    provider: "openrouter",
    id: "qwen/qwen3.6-flash",
    description: "Balanced price and quality.",
  },
  {
    provider: "openrouter",
    id: "openai/gpt-5.4-mini",
    description: "Premium, about 10x the cost.",
  },
  {
    provider: "openrouter",
    id: "google/gemini-3.6-flash",
    description: "Premium, about 10x the cost.",
  },
];
