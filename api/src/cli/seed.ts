import { closeVectorStore } from "../infra/vector-store.ts";
import { ingestProfile } from "../rag/ingest.ts";

try {
  await ingestProfile(({ inserted, total }) =>
    console.log(`✅ Documentos inseridos: ${inserted}/${total}`),
  );
  console.log("\n✅ Base de dados populada com sucesso!\n");
} catch (error) {
  console.error("❌ Falha ao popular a base:", error);
  process.exitCode = 1;
} finally {
  await closeVectorStore();
}
