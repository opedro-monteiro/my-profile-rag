import { Neo4jVectorStore } from "@langchain/neo4j";
import { getConfig } from "../config/index.ts";
import { getEmbeddings } from "./embeddings.ts";
import { isMissingIndex } from "./is-missing-index.ts";

export type StoreMode = "read" | "ingest";

export class VectorIndexNotFoundError extends Error {
  constructor(indexName: string, options?: ErrorOptions) {
    super(`Vector index "${indexName}" not found`, options);
    this.name = "VectorIndexNotFoundError";
  }
}

let storePromise: Promise<Neo4jVectorStore> | undefined;

async function connect(mode: StoreMode): Promise<Neo4jVectorStore> {
  const { neo4j } = getConfig();
  const embeddings = getEmbeddings();

  if (mode === "ingest")
    return Neo4jVectorStore.fromExistingGraph(embeddings, neo4j);

  try {
    return await Neo4jVectorStore.fromExistingIndex(embeddings, neo4j);
  } catch (error) {
    if (isMissingIndex(error))
      throw new VectorIndexNotFoundError(neo4j.indexName, { cause: error });

    throw error;
  }
}

/**
 * Shares one connection per process. The mode only applies to the first call:
 * the chat reads an existing index, and the seed may create it.
 */
export function getVectorStore(
  mode: StoreMode = "read",
): Promise<Neo4jVectorStore> {
  storePromise ??= connect(mode).catch((error: unknown) => {
    storePromise = undefined;
    throw error;
  });

  return storePromise;
}

export async function closeVectorStore(): Promise<void> {
  if (!storePromise) return;

  const store = await storePromise;
  storePromise = undefined;
  await store.close();
}
