import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidEnvError, parseEnv } from "../src/config/env.ts";

const validEnv = {
  EMBEDDING_MODEL: "Xenova/all-MiniLM-L6-v2",
  NEO4J_URI: "bolt://localhost:7688",
  NEO4J_USER: "neo4j",
  NEO4J_PASSWORD: "secret",
};

test("defaults the provider to ollama", () => {
  assert.equal(parseEnv(validEnv).LLM_PROVIDER, "ollama");
});

test("names the missing variable in the error", () => {
  const { NEO4J_URI, ...envWithoutUri } = validEnv;

  assert.throws(
    () => parseEnv(envWithoutUri),
    (error: unknown) =>
      error instanceof InvalidEnvError && error.message.includes("NEO4J_URI"),
  );
});

test("requires the api key when the provider is openrouter", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, LLM_PROVIDER: "openrouter" }),
    /OPENROUTER_API_KEY/,
  );
});
