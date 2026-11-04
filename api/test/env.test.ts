import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidEnvError, parseEnv } from "../src/config/env.ts";

const validEnv = {
  EMBEDDING_MODEL: "Xenova/all-MiniLM-L6-v2",
  NEO4J_URI: "bolt://localhost:7688",
  NEO4J_USER: "neo4j",
  NEO4J_PASSWORD: "secret",
  DATABASE_URL: "postgresql://user:secret@localhost:5434/db",
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

test("requires a postgres database url", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, DATABASE_URL: "mysql://localhost/db" }),
    /DATABASE_URL/,
  );
});

test("binds to every interface by default", () => {
  assert.equal(parseEnv(validEnv).API_HOST, "0.0.0.0");
});

test("reads the platform port when it is set", () => {
  assert.equal(parseEnv({ ...validEnv, PORT: "8080" }).PORT, 8080);
  assert.equal(parseEnv(validEnv).PORT, undefined);
});

test("splits a comma separated CORS origin list", () => {
  assert.equal(parseEnv(validEnv).CORS_ORIGIN, "*");
  assert.deepEqual(
    parseEnv({ ...validEnv, CORS_ORIGIN: "https://a.app, https://b.app" }).CORS_ORIGIN,
    ["https://a.app", "https://b.app"],
  );
});

test("splits the model allowlist", () => {
  assert.deepEqual(parseEnv(validEnv).ALLOWED_MODELS, []);
  assert.deepEqual(
    parseEnv({ ...validEnv, ALLOWED_MODELS: "ollama:gemma4:e2b, ollama:qwen2.5-coder:7b" }).ALLOWED_MODELS,
    ["ollama:gemma4:e2b", "ollama:qwen2.5-coder:7b"],
  );
});

test("requires both Cloudflare Access credentials together", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, OLLAMA_CF_CLIENT_ID: "id" }),
    /OLLAMA_CF_CLIENT_SECRET/,
  );
});

test("defaults the Neo4j database name to neo4j", () => {
  assert.equal(parseEnv(validEnv).NEO4J_DATABASE, "neo4j");
  assert.equal(
    parseEnv({ ...validEnv, NEO4J_DATABASE: "f8168dd6" }).NEO4J_DATABASE,
    "f8168dd6",
  );
});
