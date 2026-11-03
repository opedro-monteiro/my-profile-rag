import * as z from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z
  .object({
    LLM_PROVIDER: z.enum(["ollama", "openrouter"]).default("ollama"),
    OLLAMA_MODEL: z.string().min(1).default("glm-4.7-flash:latest"),
    OLLAMA_URL: z.url().default("http://localhost:11434"),
    OPENROUTER_API_KEY: optionalText,
    NLP_MODEL: optionalText,
    OPENROUTER_SITE_URL: optionalText,
    OPENROUTER_SITE_NAME: optionalText,
    EMBEDDING_MODEL: z.string().min(1),
    NEO4J_URI: z.string().min(1),
    NEO4J_USER: z.string().min(1),
    NEO4J_PASSWORD: z.string().min(1),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    API_HOST: z.string().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(0).max(65535).default(3333),
    CORS_ORIGIN: z.string().min(1).default("*"),
  })
  .superRefine((env, context) => {
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
