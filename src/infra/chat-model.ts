import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { getConfig } from "../config/index.ts";

export function createChatModel(): BaseChatModel {
  const { provider, temperature, ollama, openRouter } = getConfig().llm;

  if (provider === "ollama")
    return new ChatOllama({ ...ollama, temperature, think: false });

  console.log("🚨 Problem with Ollama");
  return new ChatOpenAI({
    model: openRouter.model,
    apiKey: openRouter.apiKey,
    temperature,
    maxRetries: openRouter.maxRetries,
    configuration: {
      baseURL: openRouter.baseUrl,
      defaultHeaders: openRouter.defaultHeaders,
    },
  });
}
