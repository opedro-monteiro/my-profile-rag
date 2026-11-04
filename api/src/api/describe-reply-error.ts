import { ModelUnavailableError } from "../infra/chat-model.ts";
import { isModelOffline } from "../infra/is-model-offline.ts";

export function describeReplyError(error: unknown): string {
  if (error instanceof ModelUnavailableError) return error.message;

  if (isModelOffline(error))
    return "O modelo local está offline no momento. Tente novamente mais tarde.";

  return "Erro ao gerar a resposta.";
}
