import type { ModelSelection } from "./chat-model.ts";

export function modelKey({ provider, model }: ModelSelection): string {
  return `${provider}:${model}`;
}
