import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { getConfig } from "../config/index.ts";

export type LlmProvider = "ollama" | "openrouter";

export interface ModelSelection {
  provider: LlmProvider;
  model: string;
  think?: boolean;
}

export class ModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelUnavailableError";
  }
}

export function defaultModelSelection(): ModelSelection {
  const { provider, ollama, openRouter } = getConfig().llm;
  const model = provider === "ollama" ? ollama.model : openRouter.model;

  return { provider, model: model ?? "", think: false };
}

export function createChatModel(
  selection: ModelSelection = defaultModelSelection(),
): BaseChatModel {
  const { temperature, ollama, openRouter } = getConfig().llm;
  const think = selection.think ?? false;

  if (selection.provider === "ollama")
    return new ChatOllama({
      baseUrl: ollama.baseUrl,
      model: selection.model,
      temperature,
      think,
    });

  if (!openRouter.apiKey)
    throw new ModelUnavailableError(
      "OpenRouter não está configurado: defina OPENROUTER_API_KEY na API.",
    );

  return new ChatOpenAI({
    model: selection.model,
    apiKey: openRouter.apiKey,
    temperature,
    maxRetries: openRouter.maxRetries,
    modelKwargs: think ? { reasoning: { effort: "medium" } } : undefined,
    configuration: {
      baseURL: openRouter.baseUrl,
      defaultHeaders: openRouter.defaultHeaders,
    },
  });
}
