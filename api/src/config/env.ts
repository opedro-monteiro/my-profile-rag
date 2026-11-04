import * as z from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const commaList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    LLM_PROVIDER: z.enum(["ollama", "openrouter"]).default("ollama"),
    OLLAMA_MODEL: z.string().min(1).default("qwen3:14b"),
    OLLAMA_URL: z.url().default("http://localhost:11434"),
    OLLAMA_CF_CLIENT_ID: optionalText,
    OLLAMA_CF_CLIENT_SECRET: optionalText,
    OPENROUTER_API_KEY: optionalText,
    NLP_MODEL: optionalText,
    OPENROUTER_SITE_URL: optionalText,
    OPENROUTER_SITE_NAME: optionalText,
    EMBEDDING_MODEL: z.string().min(1),
    NEO4J_URI: z.string().min(1),
    NEO4J_USER: z.string().min(1),
    NEO4J_PASSWORD: z.string().min(1),
    NEO4J_DATABASE: z.string().min(1).default("neo4j"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    API_HOST: z.string().min(1).default("0.0.0.0"),
    API_PORT: z.coerce.number().int().min(0).max(65535).default(3333),
    PORT: z.coerce.number().int().min(0).max(65535).optional(),
    CORS_ORIGIN: z
      .string()
      .min(1)
      .default("*")
      .transform((value) =>
        value.trim() === "*"
          ? "*"
          : value
              .split(",")
              .map((origin) => origin.trim())
              .filter(Boolean),
      ),
    ALLOWED_MODELS: commaList,
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((env, context) => {
    if (Boolean(env.OLLAMA_CF_CLIENT_ID) !== Boolean(env.OLLAMA_CF_CLIENT_SECRET))
      context.addIssue({
        code: "custom",
        path: ["OLLAMA_CF_CLIENT_SECRET"],
        message: "OLLAMA_CF_CLIENT_ID and OLLAMA_CF_CLIENT_SECRET must be set together",
      });

    if (env.LLM_PROVIDER !== "openrouter") return;

    for (const key of ["OPENROUTER_API_KEY", "NLP_MODEL"] as const)
      if (!env[key])
        context.addIssue({
          code: "custom",
          path: [key],
          message: "required when LLM_PROVIDER is openrouter",
        });
  });

export type Env = z.output<typeof envSchema>;

export class InvalidEnvError extends Error {
  constructor(problems: string[]) {
    super(`Invalid environment variables:\n${problems.join("\n")}`);
    this.name = "InvalidEnvError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map(
    (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
  );
  throw new InvalidEnvError(problems);
}
