import assert from "node:assert/strict";
import { test } from "node:test";
import { createTurnstileVerifier } from "../src/api/verify-turnstile.ts";

function verifierAnswering(result: unknown, status = 200) {
  const requests: URLSearchParams[] = [];
  const verify = createTurnstileVerifier({
    secret: "secret-value",
    hostnames: ["monteirodev.com"],
    action: "chat",
    fetch: async (_url, init) => {
      requests.push(init?.body as URLSearchParams);
      return new Response(JSON.stringify(result), { status });
    },
  });
  return { verify, requests };
}

const PASSING = { success: true, action: "chat", hostname: "monteirodev.com" };

test("accepts a token Cloudflare validates for the expected action and hostname", async () => {
  const { verify, requests } = verifierAnswering(PASSING);

  assert.equal(await verify("token", "203.0.113.7"), true);
  assert.equal(requests[0].get("secret"), "secret-value");
  assert.equal(requests[0].get("response"), "token");
  assert.equal(requests[0].get("remoteip"), "203.0.113.7");
});

test("rejects a missing or oversized token without calling Cloudflare", async () => {
  const { verify, requests } = verifierAnswering(PASSING);

  assert.equal(await verify(undefined, "203.0.113.7"), false);
  assert.equal(await verify("", "203.0.113.7"), false);
  assert.equal(await verify("x".repeat(2049), "203.0.113.7"), false);
  assert.equal(requests.length, 0);
});

test("rejects tokens Cloudflare does not validate", async () => {
  const cases = [
    { ...PASSING, success: false },
    { ...PASSING, action: "signup" },
    { ...PASSING, hostname: "evil.example" },
    { success: true },
  ];

  for (const result of cases)
    assert.equal(await verifierAnswering(result).verify("token", "1.1.1.1"), false);

  assert.equal(await verifierAnswering(PASSING, 500).verify("token", "1.1.1.1"), false);
});

test("rejects when Cloudflare cannot be reached", async () => {
  const verify = createTurnstileVerifier({
    secret: "secret-value",
    hostnames: ["monteirodev.com"],
    action: "chat",
    fetch: async () => {
      throw new TypeError("fetch failed");
    },
  });

  assert.equal(await verify("token", "1.1.1.1"), false);
});
