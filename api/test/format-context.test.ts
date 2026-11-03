import assert from "node:assert/strict";
import { test } from "node:test";
import { formatContext, NO_RESULTS_MESSAGE } from "../src/rag/retriever.ts";

test("returns the no results message for an empty list", () => {
  assert.equal(formatContext([]), NO_RESULTS_MESSAGE);
});

test("numbers each chunk and trims its text", () => {
  const context = formatContext([
    { text: " first ", score: 0.9 },
    { text: "second", score: 0.8 },
  ]);

  assert.equal(context, "[Trecho 1]\nfirst\n\n[Trecho 2]\nsecond");
});
