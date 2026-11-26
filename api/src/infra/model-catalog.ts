import * as z from "zod";
import type { CatalogEntry } from "../config/models.ts";
import type { LlmProvider, ModelSelection } from "./chat-model.ts";

export type UnavailableReason =
  | "disabled"
  | "missing_api_key"
  | "not_on_openrouter";

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

export interface ModelCatalogOptions {
  entries: readonly CatalogEntry[];
  defaultModel: ModelSelection;
  hasOpenRouterKey: boolean;
  fetchOpenRouterModels: FetchOpenRouterModels;
  /** How long a fetched OpenRouter list is reused. */
  ttlMs?: number;
  timeoutMs?: number;
  onFetchError?: (error: unknown) => void;
  now?: () => number;
}

export interface ModelCatalog {
  list(): Promise<ModelList>;
  isAllowed(selection: ModelSelection): boolean;
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
  ttlMs = 60 * 60 * 1000,
  timeoutMs = 5000,
  onFetchError,
  now = Date.now,
}: ModelCatalogOptions): ModelCatalog {
  const wantsOpenRouter = entries.some(
    (entry) => entry.provider === "openrouter",
  );
  let cache: { at: number; models: Map<string, OpenRouterModel> } | undefined;
  let inFlight: Promise<Map<string, OpenRouterModel> | undefined> | undefined;

  async function refresh() {
    try {
      const models = await fetchOpenRouterModels(
        AbortSignal.timeout(timeoutMs),
      );
      cache = {
        at: now(),
        models: new Map(models.map((model) => [model.id, model])),
      };
    } catch (error) {
      onFetchError?.(error);
    }
    return cache?.models;
  }

  function openRouterModels() {
    if (!wantsOpenRouter) return undefined;
    if (cache && now() - cache.at < ttlMs) return cache.models;

    inFlight ??= refresh().finally(() => (inFlight = undefined));
    return inFlight;
  }

  function describe(
    entry: CatalogEntry,
    live: Map<string, OpenRouterModel> | undefined,
  ): ModelDescriptor {
    const remote =
      entry.provider === "openrouter" ? live?.get(entry.id) : undefined;
    const reason: UnavailableReason | undefined =
      entry.enabled === false
        ? "disabled"
        : entry.provider !== "openrouter"
          ? undefined
          : !hasOpenRouterKey
            ? "missing_api_key"
            : live && !remote
              ? "not_on_openrouter"
              : undefined;

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
    async list() {
      const live = await openRouterModels();
      return {
        models: entries.map((entry) => describe(entry, live)),
        default: {
          provider: defaultModel.provider,
          model: defaultModel.model,
        },
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
