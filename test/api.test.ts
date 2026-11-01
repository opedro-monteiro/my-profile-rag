import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { ReplyEvent } from "../src/agent/stream-reply.ts";
import { buildApp, type ReplyStreamer } from "../src/api/app.ts";

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
    yield { type: "tool", name: "search_profile" };
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
      'event: tool\ndata: {"name":"search_profile"}\n\n' +
      'event: text\ndata: {"text":"Olá"}\n\n' +
      "event: done\ndata: {}\n\n",
  );
});

test("creates a thread id when the client sends none", async () => {
  let receivedThreadId = "";
  const app = await buildChatApp(async function* (_message, threadId) {
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

  const app = await buildChatApp(async function* (_message, _threadId, signal) {
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
