import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { getConfig } from "../config/index.ts";

let embeddings: HuggingFaceTransformersEmbeddings | undefined;

export function getEmbeddings(): HuggingFaceTransformersEmbeddings {
  const { modelName, pretrainedOptions } = getConfig().embedding;

  embeddings ??= new HuggingFaceTransformersEmbeddings({
    model: modelName,
    pretrainedOptions,
  });

  return embeddings;
}
