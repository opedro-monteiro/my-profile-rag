import type { Neo4jVectorStore } from "@langchain/neo4j";
import { getConfig } from "../config/index.ts";
import { getVectorStore } from "../infra/vector-store.ts";
import { loadAndSplitPdf } from "./document-loader.ts";

export interface IngestProgress {
  inserted: number;
  total: number;
}

async function clearChunks(store: Neo4jVectorStore, nodeLabel: string) {
  await store.query(`MATCH (n:\`${nodeLabel}\`) DETACH DELETE n`);
}

export async function ingestProfile(
  onProgress: (progress: IngestProgress) => void,
): Promise<void> {
  const { pdf, textSplitter, ingestion, neo4j } = getConfig();

  const documents = await loadAndSplitPdf(pdf.path, textSplitter);
  if (documents.length === 0)
    throw new Error(`No text extracted from ${pdf.path}`);

  const store = await getVectorStore("ingest");
  await clearChunks(store, neo4j.nodeLabel);

  for (let start = 0; start < documents.length; start += ingestion.batchSize) {
    const batch = documents.slice(start, start + ingestion.batchSize);
    await store.addDocuments(batch);
    onProgress({ inserted: start + batch.length, total: documents.length });
  }
}
