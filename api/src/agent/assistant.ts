import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import {
  createChatModel,
  defaultModelSelection,
  type ModelSelection,
} from "../infra/chat-model.ts";
import { tools } from "../tools/index.ts";
import { SYSTEM_PROMPT } from "./system-prompt.ts";

export function createAssistant(
  selection?: ModelSelection,
  checkpointer = new MemorySaver(),
) {
  return createAgent({
    model: createChatModel(selection),
    tools,
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
  });
}

export type Assistant = ReturnType<typeof createAssistant>;

/**
 * One agent per model, all sharing a checkpointer, so a thread keeps its
 * history when the user switches models mid-conversation.
 */
export function createAssistantPool() {
  const checkpointer = new MemorySaver();
  const assistants = new Map<string, Assistant>();

  return (selection: ModelSelection = defaultModelSelection()): Assistant => {
    const key = `${selection.provider}:${selection.model}:${selection.think ? 1 : 0}`;
    let assistant = assistants.get(key);

    if (!assistant) {
      assistant = createAssistant(selection, checkpointer);
      assistants.set(key, assistant);
    }

    return assistant;
  };
}
