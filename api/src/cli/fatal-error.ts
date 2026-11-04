import { InvalidEnvError } from "../config/env.ts";
import { VectorIndexNotFoundError } from "../infra/vector-store.ts";

export function describeFatalError(error: unknown): string {
  if (error instanceof InvalidEnvError) return error.message;
  if (error instanceof VectorIndexNotFoundError)
    return `${error.message}. Rode "npm run seed" antes de conversar.`;

  if (
    (error as { code?: unknown } | null)?.code ===
    "Neo.ClientError.Database.DatabaseNotFound"
  )
    return 'O banco do Neo4j não existe. Defina NEO4J_DATABASE (no Aura, é o ID da instância).';

  if (
    (error as { code?: unknown } | null)?.code ===
    "Neo.ClientError.Procedure.ProcedureNotFound"
  )
    return 'O Neo4j está em Cypher 25 e o LangChain precisa de Cypher 5. Rode no console do Neo4j: ALTER DATABASE <NEO4J_DATABASE> SET DEFAULT LANGUAGE CYPHER 5';

  if (isMissingTable(error))
    return 'As tabelas do Postgres não existem. Rode "npm run db:migrate".';

  const detail = error instanceof Error ? error.message : String(error);
  return `Não foi possível iniciar: ${detail}\nVerifique se o Neo4j e o Postgres estão acessíveis (localmente: "npm run infra:up").`;
}

/** Postgres "undefined_table" error code. */
function isMissingTable(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "42P01";
}
