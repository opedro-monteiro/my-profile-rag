import { getConfig } from "../config/index.ts";
import { getVectorStore } from "../infra/vector-store.ts";

export interface RetrievedChunk {
  text: string;
  score: number;
}

export const NO_RESULTS_MESSAGE =
  "Nenhuma informação encontrada no perfil para esta pergunta.";

export async function retrieveProfileChunks(
  question: string,
): Promise<RetrievedChunk[]> {
  const { topK, minScore } = getConfig().similarity;

  const store = await getVectorStore();
  const results = await store.similaritySearchWithScore(question, topK);

  return results
    .map(([document, score]) => ({ text: document.pageContent, score }))
    .filter((chunk) => chunk.score >= minScore);
}

export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return NO_RESULTS_MESSAGE;

  return chunks
    .map((chunk, index) => `[Trecho ${index + 1}]\n${chunk.text.trim()}`)
    .join("\n\n");
}
