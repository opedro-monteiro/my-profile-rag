import { InvalidEnvError } from "../config/env.ts";
import { VectorIndexNotFoundError } from "../infra/vector-store.ts";

export function describeFatalError(error: unknown): string {
  if (error instanceof InvalidEnvError) return error.message;
  if (error instanceof VectorIndexNotFoundError)
    return `${error.message}. Rode "npm run seed" antes de conversar.`;

  const detail = error instanceof Error ? error.message : String(error);
  return `Não foi possível iniciar: ${detail}\nVerifique se o Neo4j está no ar com "npm run infra:up".`;
}
