import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { createChatModel } from "../infra/chat-model.ts";
import { tools } from "../tools/index.ts";
import { SYSTEM_PROMPT } from "./system-prompt.ts";

export function createAssistant() {
  return createAgent({
    model: createChatModel(),
    tools,
    systemPrompt: SYSTEM_PROMPT,
    checkpointer: new MemorySaver(),
  });
}

export type Assistant = ReturnType<typeof createAssistant>;
