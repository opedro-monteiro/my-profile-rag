import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { ReplyEvent } from "../src/agent/stream-reply.ts";
import { buildApp, type ReplyStreamer } from "../src/api/app.ts";
import { ModelUnavailableError } from "../src/infra/chat-model.ts";
import type { ReplyUsage } from "../src/usage/track-usage.ts";
import type { UsageStore } from "../src/usage/usage-store.ts";

const THREAD_ID = "6f1c2a3e-8b4d-4c55-9a10-2d3e4f5a6b7c";

function postChat(
  app: Awaited<ReturnType<typeof buildApp>>,
  body: object,
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: "POST",
    url: "/api/chat/stream",
    payload: body,
    headers,
  });
}

function buildChatApp(streamReply: ReplyStreamer) {
  return buildApp({ corsOrigin: "*", streamReply });
}

test("streams the reply as server-sent events", async () => {
  const app = await buildChatApp(async function* (): AsyncGenerator<ReplyEvent> {
    yield { type: "tool", id: "call-1", name: "search_profile" };
    yield { type: "text", text: "Olá" };
  });

  const response = await postChat(app, {
    message: "oi",
    threadId: THREAD_ID,
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] as string, /text\/event-stream/);
  assert.equal(
    response.payload,
    `event: start\ndata: {"threadId":"${THREAD_ID}"}\n\n` +
      'event: tool\ndata: {"id":"call-1","name":"search_profile"}\n\n' +
      'event: text\ndata: {"text":"Olá"}\n\n' +
      "event: done\ndata: {}\n\n",
  );
});

test("creates a thread id when the client sends none", async () => {
  let receivedThreadId = "";
  const app = await buildChatApp(async function* ({ threadId }) {
    receivedThreadId = threadId;
  });

  const response = await postChat(app, { message: "oi" });

  assert.ok(response.payload.includes(`"threadId":"${receivedThreadId}"`));
});

test("rejects invalid bodies", async () => {
  const app = await buildChatApp(async function* () {});

  for (const body of [
    {},
    { message: "   " },
    { message: "oi", threadId: "not-a-uuid" },
    { message: "x".repeat(4001) },
    { message: "oi", model: { provider: "openai", model: "gpt" } },
    { message: "oi", model: { provider: "ollama", model: "a b" } },
  ])
    assert.equal((await postChat(app, body)).statusCode, 400);
});

test("reports failures without leaking their detail", async () => {
  const app = await buildChatApp(async function* () {
    throw new Error("bolt://secret-host refused");
  });

  const response = await postChat(app, { message: "oi" });

  assert.match(response.payload, /event: error/);
  assert.doesNotMatch(response.payload, /secret-host/);
});

test("allows cross-origin requests", async () => {
  const app = await buildChatApp(async function* () {});

  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/api/chat/stream",
    headers: {
      origin: "http://localhost:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  const response = await postChat(
    app,
    { message: "oi" },
    { origin: "http://localhost:5173" },
  );

  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], "*");
  assert.equal(response.headers["access-control-allow-origin"], "*");
});

test("aborts the reply when the client disconnects", async () => {
  let resolveAborted: () => void;
  const aborted = new Promise<void>((resolve) => (resolveAborted = resolve));

  const app = await buildChatApp(async function* (_request, signal) {
    signal.addEventListener("abort", () => resolveAborted());
    yield { type: "text", text: "parcial" };
    await once(signal, "abort").catch(() => {});
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });

  const client = new AbortController();
  const response = await fetch(`${address}/api/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "oi" }),
    signal: client.signal,
  });
  await response.body?.getReader().read();
  client.abort();

  await aborted;
  await app.close();
});

test("passes the selected model to the streamer", async () => {
  let received: unknown;
  const app = await buildChatApp(async function* ({ model }) {
    received = model;
  });
  const model = { provider: "ollama", model: "qwen3:8b", think: true };

  await postChat(app, { message: "oi", model });

  assert.deepEqual(received, model);
});

test("surfaces model configuration errors", async () => {
  const app = await buildChatApp(async function* () {
    throw new ModelUnavailableError("OpenRouter não está configurado.");
  });

  const response = await postChat(app, { message: "oi" });

  assert.match(response.payload, /OpenRouter não está configurado/);
});

test("lists the registered tools", async () => {
  const tools = [{ name: "search_profile", description: "x", parameters: {} }];
  const app = await buildApp({
    corsOrigin: "*",
    tools,
    streamReply: async function* () {},
  });

  const response = await app.inject({ method: "GET", url: "/api/tools" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { tools });
});

function fakeUsageStore() {
  const saved: ReplyUsage[] = [];
  let since: Date | undefined;
  const store: UsageStore = {
    async record(usage) {
      saved.push(usage);
    },
    async list(from) {
      since = from;
      return [];
    },
  };
  return { store, saved, since: () => since };
}

const DEFAULT_MODEL = { provider: "ollama", model: "gemma4:e2b" } as const;

test("records the usage of each reply", async () => {
  const usage = fakeUsageStore();
  const app = await buildApp({
    corsOrigin: "*",
    usage: { store: usage.store, defaultModel: DEFAULT_MODEL },
    streamReply: async function* (): AsyncGenerator<ReplyEvent> {
      yield { type: "tool", id: "call-1", name: "search_profile" };
      yield { type: "usage", inputTokens: 100, outputTokens: 10, totalTokens: 110 };
      yield {
        type: "tool_result",
        id: "call-1",
        name: "search_profile",
        output: "…",
        status: "success",
      };
      yield { type: "usage", inputTokens: 300, outputTokens: 40, totalTokens: 340 };
      yield { type: "text", text: "Olá" };
    },
  });

  await postChat(app, { message: "oi", threadId: THREAD_ID });

  assert.equal(usage.saved.length, 1);
  assert.partialDeepStrictEqual(usage.saved[0], {
    threadId: THREAD_ID,
    provider: "ollama",
    model: "gemma4:e2b",
    status: "done",
    inputTokens: 400,
    outputTokens: 50,
    totalTokens: 450,
    modelCalls: 2,
    tools: [{ callId: "call-1", name: "search_profile", status: "success" }],
  });
});

test("records failed replies with the requested model", async () => {
  const usage = fakeUsageStore();
  const app = await buildApp({
    corsOrigin: "*",
    usage: { store: usage.store, defaultModel: DEFAULT_MODEL },
    streamReply: async function* () {
      throw new Error("boom");
    },
  });

  await postChat(app, {
    message: "oi",
    model: { provider: "openrouter", model: "z-ai/glm-5.3-flash" },
  });

  assert.partialDeepStrictEqual(usage.saved[0], {
    provider: "openrouter",
    model: "z-ai/glm-5.3-flash",
    status: "error",
    tools: [],
  });
});

test("serves the recorded usage for a range", async () => {
  const usage = fakeUsageStore();
  const app = await buildApp({
    corsOrigin: "*",
    usage: { store: usage.store, defaultModel: DEFAULT_MODEL },
    streamReply: async function* () {},
  });

  const week = await app.inject({ method: "GET", url: "/api/usage" });
  const weekSince = usage.since();
  const all = await app.inject({ method: "GET", url: "/api/usage?range=all" });
  const invalid = await app.inject({ method: "GET", url: "/api/usage?range=1y" });

  assert.equal(week.statusCode, 200);
  assert.deepEqual(week.json(), { records: [] });
  assert.ok(weekSince && Date.now() - weekSince.getTime() >= 7 * 86_400_000 - 1000);
  assert.equal(all.statusCode, 200);
  assert.equal(usage.since(), undefined);
  assert.equal(invalid.statusCode, 400);
});

test("answers the health check", async () => {
  const app = await buildChatApp(async function* () {});

  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
});

test("tells the client when the local model is offline", async () => {
  const app = await buildChatApp(async function* () {
    throw new TypeError("fetch failed");
  });

  const response = await postChat(app, { message: "oi" });

  assert.match(response.payload, /modelo local está offline/);
});

test("rejects a model outside the allowlist", async () => {
  const app = await buildApp({
    corsOrigin: "*",
    allowedModels: ["ollama:gemma4:e2b"],
    streamReply: async function* () {},
  });

  const blocked = await postChat(app, {
    message: "oi",
    model: { provider: "openrouter", model: "z-ai/glm-5.3-flash" },
  });
  const allowed = await postChat(app, {
    message: "oi",
    model: { provider: "ollama", model: "gemma4:e2b" },
  });

  assert.equal(blocked.statusCode, 400);
  assert.deepEqual(blocked.json(), { message: "Modelo não disponível." });
  assert.equal(allowed.statusCode, 200);
});

test("rate limits the chat per client", async () => {
  const app = await buildApp({
    corsOrigin: "*",
    chatRateLimit: { max: 2, timeWindow: 60_000 },
    streamReply: async function* () {},
  });

  await postChat(app, { message: "oi" });
  await postChat(app, { message: "oi" });
  const response = await postChat(app, { message: "oi" });

  assert.equal(response.statusCode, 429);
  assert.match(response.json().message, /Aguarde um minuto/);
});

test("counts each forwarded client separately behind a trusted proxy", async () => {
  const app = await buildApp({
    corsOrigin: "*",
    trustProxy: 1,
    chatRateLimit: { max: 1, timeWindow: 60_000 },
    streamReply: async function* () {},
  });

  const first = await postChat(app, { message: "oi" }, { "x-forwarded-for": "203.0.113.1" });
  const second = await postChat(app, { message: "oi" }, { "x-forwarded-for": "203.0.113.2" });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
});

test("only allows the configured origins", async () => {
  const app = await buildApp({
    corsOrigin: ["https://app.example.com"],
    streamReply: async function* () {},
  });

  const listed = await app.inject({
    method: "GET",
    url: "/health",
    headers: { origin: "https://app.example.com" },
  });
  const unlisted = await app.inject({
    method: "GET",
    url: "/health",
    headers: { origin: "https://evil.example.com" },
  });

  assert.equal(listed.headers["access-control-allow-origin"], "https://app.example.com");
  assert.equal(unlisted.headers["access-control-allow-origin"], undefined);
});
