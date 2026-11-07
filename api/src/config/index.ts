import type {
  DataType,
  PretrainedModelOptions,
} from "@huggingface/transformers";
import { parseEnv, type Env } from "./env.ts";

function buildConfig(env: Env) {
  return Object.freeze({
    api: {
      host: env.API_HOST,
      port: env.PORT ?? env.API_PORT,
      corsOrigin: env.CORS_ORIGIN,
      allowedModels: env.ALLOWED_MODELS,
      trustProxy: env.TRUST_PROXY_HOPS,
      chatRateLimit: { max: 10, timeWindow: 60_000 },
      turnstile: env.TURNSTILE_SECRET
        ? {
            secret: env.TURNSTILE_SECRET,
            hostnames: env.TURNSTILE_HOSTNAMES,
            action: "chat",
          }
        : undefined,
    },
    llm: {
      provider: env.LLM_PROVIDER,
      temperature: 0,
      ollama: {
        model: env.OLLAMA_MODEL,
        baseUrl: env.OLLAMA_URL,
        headers:
          env.OLLAMA_CF_CLIENT_ID && env.OLLAMA_CF_CLIENT_SECRET
            ? {
                "CF-Access-Client-Id": env.OLLAMA_CF_CLIENT_ID,
                "CF-Access-Client-Secret": env.OLLAMA_CF_CLIENT_SECRET,
              }
            : undefined,
      },
      openRouter: {
        model: env.NLP_MODEL,
        apiKey: env.OPENROUTER_API_KEY,
        baseUrl: "https://openrouter.ai/api/v1",
        maxRetries: 2,
        defaultHeaders: {
          "HTTP-Referer": env.OPENROUTER_SITE_URL ?? "",
          "X-Title": env.OPENROUTER_SITE_NAME ?? "",
        },
      },
    },
    neo4j: {
      url: env.NEO4J_URI,
      username: env.NEO4J_USER,
      password: env.NEO4J_PASSWORD,
      database: env.NEO4J_DATABASE,
      indexName: "tensors_index",
      searchType: "vector" as const,
      textNodeProperties: ["text"],
      nodeLabel: "Chunk",
    },
    github: {
      user: env.GITHUB_USER,
      baseUrl: "https://api.github.com",
    },
    database: {
      url: env.DATABASE_URL,
      maxConnections: 10,
      migrationsFolder: "./drizzle",
    },
    embedding: {
      modelName: env.EMBEDDING_MODEL,
      pretrainedOptions: {
        dtype: "fp32" as DataType,
      } satisfies PretrainedModelOptions,
    },
    pdf: {
      path: "./data/Profile.pdf",
    },
    textSplitter: {
      chunkSize: 1000,
      chunkOverlap: 200,
    },
    ingestion: {
      batchSize: 16,
    },
    similarity: {
      topK: 10,
      // Measured scores do not separate relevant from unrelated chunks, so a
      // higher floor drops real answers. Recalibrate if the embedding model changes.
      minScore: 0,
    },
  });
}

export type AppConfig = ReturnType<typeof buildConfig>;

let config: AppConfig | undefined;

export function getConfig(): AppConfig {
  config ??= buildConfig(parseEnv(process.env));
  return config;
}
