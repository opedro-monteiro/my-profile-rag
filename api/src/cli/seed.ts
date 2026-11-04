import { closeVectorStore } from "../infra/vector-store.ts";
import { describeFatalError } from "./fatal-error.ts";
import { ingestProfile } from "../rag/ingest.ts";

try {
  await ingestProfile(({ inserted, total }) =>
    console.log(`✅ Documentos inseridos: ${inserted}/${total}`),
  );
  console.log("\n✅ Base de dados populada com sucesso!\n");
} catch (error) {
  console.error(`❌ Falha ao popular a base: ${describeFatalError(error)}`);
  process.exitCode = 1;
} finally {
  await closeVectorStore();
}
