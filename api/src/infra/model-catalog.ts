import * as z from "zod";
import type { CatalogEntry } from "../config/models.ts";
import type { LlmProvider, ModelSelection } from "./chat-model.ts";

export type UnavailableReason =
  | "disabled"
  | "token_required"
  | "missing_api_key"
  | "not_on_openrouter"
  | "ollama_offline";

export interface ModelDescriptor {
  provider: LlmProvider;
  id: string;
  label: string;
  description: string;
  /** Null when OpenRouter could not be reached and the catalog gives none. */
  contextWindow: number | null;
  supportsThinking: boolean;
  available: boolean;
  unavailableReason?: UnavailableReason;
}

export interface ModelList {
  models: ModelDescriptor[];
  default: { provider: LlmProvider; model: string };
  /** "full" when the request carried a valid access token. */
  access: "full" | "local";
}

const openRouterModelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      context_length: z.number().nullish(),
      supported_parameters: z.array(z.string()).nullish(),
    }),
  ),
});

export type OpenRouterModel = z.output<
  typeof openRouterModelsSchema
>["data"][number];

export type FetchOpenRouterModels = (
  signal: AbortSignal,
) => Promise<OpenRouterModel[]>;

export type CheckOllama = (signal: AbortSignal) => Promise<boolean>;

export function openRouterModelsFetcher(
  baseUrl: string,
): FetchOpenRouterModels {
  return async (signal) => {
    const response = await fetch(`${baseUrl}/models`, { signal });
    if (!response.ok)
      throw new Error(`OpenRouter /models answered ${response.status}`);

    return openRouterModelsSchema.parse(await response.json()).data;
  };
}

export function ollamaChecker(baseUrl: string): CheckOllama {
  return async (signal) => {
    try {
      const response = await fetch(`${baseUrl}/api/version`, { signal });
      return response.ok;
    } catch {
      return false;
    }
  };
}

export interface ModelCatalogOptions {
  entries: readonly CatalogEntry[];
  defaultModel: ModelSelection;
  hasOpenRouterKey: boolean;
  fetchOpenRouterModels: FetchOpenRouterModels;
  /** Without it, Ollama is assumed to be running. */
  checkOllama?: CheckOllama;
  /** How long a fetched OpenRouter list is reused. */
  ttlMs?: number;
  /** How long an Ollama check is reused. */
  ollamaTtlMs?: number;
  timeoutMs?: number;
  onFetchError?: (error: unknown) => void;
  now?: () => number;
}

export interface ModelCatalog {
  readonly defaultModel: ModelSelection;
  /** `granted` is whether the request carried a valid access token. */
  list(granted: boolean): Promise<ModelList>;
  isAllowed(selection: ModelSelection): boolean;
}

/** Caches an async lookup for `ttlMs`, sharing one call between callers. */
function cached<T>(load: () => Promise<T>, ttlMs: number, now: () => number) {
  let value: { at: number; result: T } | undefined;
  let inFlight: Promise<T> | undefined;

  return () => {
    if (value && now() - value.at < ttlMs) return Promise.resolve(value.result);

    inFlight ??= load()
      .then((result) => {
        value = { at: now(), result };
        return result;
      })
      .finally(() => (inFlight = undefined));
    return inFlight;
  };
}

/**
 * Lists the configured models, filling OpenRouter entries from its live
 * catalogue. A failed fetch keeps the last good list, or falls back to what
 * the config says, so the picker never goes empty because OpenRouter is down.
 */
export function createModelCatalog({
  entries,
  defaultModel,
  hasOpenRouterKey,
  fetchOpenRouterModels,
  checkOllama,
  ttlMs = 60 * 60 * 1000,
  ollamaTtlMs = 15 * 1000,
  timeoutMs = 5000,
  onFetchError,
  now = Date.now,
}: ModelCatalogOptions): ModelCatalog {
  const wantsOpenRouter = entries.some(
    (entry) => entry.provider === "openrouter",
  );
  let lastGood: Map<string, OpenRouterModel> | undefined;

  const openRouterModels = cached(
    async () => {
      try {
        const models = await fetchOpenRouterModels(
          AbortSignal.timeout(timeoutMs),
        );
        lastGood = new Map(models.map((model) => [model.id, model]));
        return lastGood;
      } catch (error) {
        onFetchError?.(error);
        throw error;
      }
    },
    ttlMs,
    now,
  );

  const ollamaOnline = cached(
    () =>
      checkOllama
        ? checkOllama(AbortSignal.timeout(Math.min(timeoutMs, 2000)))
        : Promise.resolve(true),
    ollamaTtlMs,
    now,
  );

  function reasonFor(
    entry: CatalogEntry,
    granted: boolean,
    live: Map<string, OpenRouterModel> | undefined,
    ollamaUp: boolean,
  ): UnavailableReason | undefined {
    if (entry.enabled === false) return "disabled";
    if (entry.provider === "ollama") return ollamaUp ? undefined : "ollama_offline";
    if (!granted) return "token_required";
    if (!hasOpenRouterKey) return "missing_api_key";
    if (live && !live.has(entry.id)) return "not_on_openrouter";
    return undefined;
  }

  function describe(
    entry: CatalogEntry,
    reason: UnavailableReason | undefined,
    live: Map<string, OpenRouterModel> | undefined,
  ): ModelDescriptor {
    const remote =
      entry.provider === "openrouter" ? live?.get(entry.id) : undefined;

    return {
      provider: entry.provider,
      id: entry.id,
      label: entry.label ?? remote?.name ?? entry.id,
      description: entry.description ?? "",
      contextWindow: entry.contextWindow ?? remote?.context_length ?? null,
      supportsThinking:
        entry.supportsThinking ??
        remote?.supported_parameters?.includes("reasoning") ??
        false,
      available: reason === undefined,
      ...(reason ? { unavailableReason: reason } : {}),
    };
  }

  return {
    defaultModel,

    async list(granted) {
      const [live, ollamaUp] = await Promise.all([
        wantsOpenRouter
          ? openRouterModels().catch(() => lastGood)
          : Promise.resolve(undefined),
        entries.some((entry) => entry.provider === "ollama")
          ? ollamaOnline()
          : Promise.resolve(true),
      ]);

      return {
        models: entries.map((entry) =>
          describe(entry, reasonFor(entry, granted, live, ollamaUp), live),
        ),
        default: {
          provider: defaultModel.provider,
          model: defaultModel.model,
        },
        access: granted ? "full" : "local",
      };
    },

    isAllowed({ provider, model }) {
      if (provider === defaultModel.provider && model === defaultModel.model)
        return true;

      return entries.some(
        (entry) =>
          entry.provider === provider &&
          entry.id === model &&
          entry.enabled !== false,
      );
    },
  };
}
