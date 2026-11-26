import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogEntry } from "../src/config/models.ts";
import {
  createModelCatalog,
  type ModelCatalogOptions,
  type OpenRouterModel,
} from "../src/infra/model-catalog.ts";

const ENTRIES: CatalogEntry[] = [
  { provider: "ollama", id: "local", label: "Local", contextWindow: 8000 },
  { provider: "ollama", id: "off", contextWindow: 8000, enabled: false },
  { provider: "openrouter", id: "vendor/hosted" },
  { provider: "openrouter", id: "vendor/gone", label: "Gone" },
];

const REMOTE: OpenRouterModel[] = [
  {
    id: "vendor/hosted",
    name: "Hosted Model",
    context_length: 200_000,
    supported_parameters: ["reasoning", "tools"],
  },
];

function catalog(options: Partial<ModelCatalogOptions> = {}) {
  return createModelCatalog({
    entries: ENTRIES,
    defaultModel: { provider: "ollama", model: "local" },
    hasOpenRouterKey: true,
    fetchOpenRouterModels: async () => REMOTE,
    ...options,
  });
}

function byId(list: Awaited<ReturnType<ReturnType<typeof catalog>["list"]>>) {
  return Object.fromEntries(list.models.map((model) => [model.id, model]));
}

test("fills OpenRouter entries from its catalogue", async () => {
  const models = byId(await catalog().list());

  assert.deepEqual(models["vendor/hosted"], {
    provider: "openrouter",
    id: "vendor/hosted",
    label: "Hosted Model",
    description: "",
    contextWindow: 200_000,
    supportsThinking: true,
    available: true,
  });
  assert.equal(models["vendor/gone"]?.unavailableReason, "not_on_openrouter");
  assert.equal(models.off?.unavailableReason, "disabled");
  assert.equal(models.local?.available, true);
});

test("locks OpenRouter models without an API key", async () => {
  const models = byId(await catalog({ hasOpenRouterKey: false }).list());

  assert.equal(models["vendor/hosted"]?.unavailableReason, "missing_api_key");
  assert.equal(models.local?.available, true);
});

test("falls back to the config when OpenRouter cannot be reached", async () => {
  const errors: unknown[] = [];
  const models = byId(
    await catalog({
      fetchOpenRouterModels: async () => {
        throw new Error("offline");
      },
      onFetchError: (error) => errors.push(error),
    }).list(),
  );

  assert.equal(errors.length, 1);
  assert.equal(models["vendor/hosted"]?.available, true);
  assert.equal(models["vendor/hosted"]?.contextWindow, null);
  assert.equal(models["vendor/gone"]?.label, "Gone");
});

test("reuses the fetched list until it expires", async () => {
  let calls = 0;
  let time = 0;
  const models = catalog({
    ttlMs: 1000,
    now: () => time,
    fetchOpenRouterModels: async () => {
      calls++;
      return REMOTE;
    },
  });

  await Promise.all([models.list(), models.list()]);
  time = 999;
  await models.list();
  assert.equal(calls, 1);

  time = 1000;
  await models.list();
  assert.equal(calls, 2);
});

test("allows only enabled catalog models and the default", () => {
  const models = catalog({
    defaultModel: { provider: "openrouter", model: "vendor/env-default" },
  });

  assert.equal(models.isAllowed({ provider: "ollama", model: "local" }), true);
  assert.equal(
    models.isAllowed({ provider: "openrouter", model: "vendor/hosted" }),
    true,
  );
  assert.equal(
    models.isAllowed({ provider: "openrouter", model: "vendor/env-default" }),
    true,
  );
  assert.equal(models.isAllowed({ provider: "ollama", model: "off" }), false);
  assert.equal(
    models.isAllowed({ provider: "openrouter", model: "local" }),
    false,
  );
  assert.equal(
    models.isAllowed({ provider: "openrouter", model: "vendor/other" }),
    false,
  );
});
