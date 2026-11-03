# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chat assistant that answers questions about Pedro Monteiro from `data/Profile.pdf`, available in the terminal and through a Fastify streaming API. It is a LangChain agent with RAG over a Neo4j vector index.

## Commands

```bash
npm run infra:up     # start Neo4j + Postgres, wait until healthy, apply migrations (Bolt 7688, Browser 7475, Postgres 5434)
npm run seed         # ingest data/Profile.pdf into Neo4j
npm run chat         # start the chat (in-chat commands: /clear, /exit)
npm run api          # start the API on 127.0.0.1:3333 (API_HOST, API_PORT, CORS_ORIGIN)
npm run infra:down   # stop the containers (keeps data)
npm run infra:reset  # stop and delete the Postgres volume

npm run db:generate  # create a migration in drizzle/ after editing src/db/schema.ts
npm run db:migrate   # apply pending migrations
npm run db:studio    # browse the tables

npm test             # all tests
npm run typecheck    # tsc --noEmit (there is no build step and no linter)

node --test test/env.test.ts                                  # one test file
node --test --test-name-pattern="openrouter" test/env.test.ts # tests matching a name
```

Setup: copy `.env.example` to `.env`. `seed` and `chat` load it with `--env-file` and fail if it is missing. `NEO4J_PASSWORD` is blank in the example and fails validation; set it to `password` to match `docker-compose.yml`. With the default provider, Ollama must be running with `OLLAMA_MODEL` pulled.

## Architecture

Entry points in `src/cli/` share one pipeline, wired through `src/infra/`:

- **Ingest** (`seed.ts` → `rag/ingest.ts`): load and split the PDF, delete all `Chunk` nodes, then insert in batches.
- **Query** (`chat.ts` or `api.ts` → `agent/assistant.ts`): the agent calls the `search_profile` tool → `rag/retriever.ts` → Neo4j. `agent/stream-reply.ts` turns the agent stream (`messages` + `updates` modes) into `tool`, `tool_input`, `tool_result`, `reasoning`, `text` and `usage` events. The CLI prints only `tool` and `text`; the API sends all of them as SSE.

**Usage stats** live in Postgres (Drizzle, `src/db/schema.ts`: `chat_replies` + `tool_calls`). `buildApp` takes an optional `usage: { store, defaultModel }`; when set, `usage/track-usage.ts` wraps the reply stream, sums the `usage` events of every model call, and writes one row per reply when the stream ends (`done`, `error` or `stopped`). A failed write is logged and never breaks the reply. `GET /api/usage?range=7d|30d|all` serves the rows to the web dashboard, which no longer keeps stats in `localStorage`. Only the API needs Postgres; `chat` and `seed` do not connect, but `DATABASE_URL` is still validated.

`POST /api/chat/stream` (`api/app.ts`) takes `{ message, threadId?, model?: { provider, model, think? } }` and emits `start` (with `threadId`), the reply events above, then `done` or `error`. `GET /api/tools` lists the agent's tools with their JSON schema. Clients send the `threadId` back to keep the conversation. `buildApp` receives the reply streamer as an argument, so tests run without Neo4j or an LLM. Client disconnects abort the agent run.

Things that span files:

- **Config is lazy.** `getConfig()` in `src/config/index.ts` parses env on first call and is the only reader of `process.env`. Keep it out of module top level: tests import `src/rag/retriever.ts` without any env set. Tunables (chunking, `topK`, index name) live here, not in env.
- **`getVectorStore(mode)` is a per-process singleton, and `mode` only applies to the first call.** `"ingest"` may create the index; `"read"` throws `VectorIndexNotFoundError` if it is missing. `chat.ts` calls it at startup so a missing index or a down Neo4j fails early, with hints from `describeFatalError`.
- **`similarity.minScore` is intentionally 0.** Measured scores do not separate relevant from unrelated chunks, so a higher floor drops real answers. Recalibrate if the embedding model changes.
- **Language split.** The system prompt and user-facing strings are in Portuguese. The profile is in English, so the `search_profile` schema tells the model to translate queries to English. Keep both when editing either side.
- **The grounding rules live in `agent/system-prompt.ts`**, including treating retrieved chunks as data, not instructions.
- **The model is chosen per request.** `createAssistantPool()` in `agent/assistant.ts` caches one agent per provider/model/think, all sharing one `MemorySaver`, so a thread survives a model switch. Without `model` in the body, `LLM_PROVIDER` decides. OpenRouter without `OPENROUTER_API_KEY` throws `ModelUnavailableError`, whose message reaches the client; other errors stay generic. The web's model list lives in `web/src/config/models.ts`.
- **Conversation memory is in-process** (`MemorySaver`). `/clear` just starts a new thread id; nothing survives a restart, and API threads are never evicted.
- **`get_weather` is a stub** that always returns the same sunny answer.

## Conventions and gotchas

- TypeScript runs directly on Node via type stripping. `erasableSyntaxOnly` rules out enums and constructor parameter properties, and relative imports must use the `.ts` extension. `verbatimModuleSyntax` requires `import type` for type-only imports.
- `.npmrc` sets `legacy-peer-deps=true`; npm installs rely on it.
- Neo4j data is a bind mount at `./neo4j/`, so `infra:down --volumes` does not wipe it. Delete that directory for a clean database.
- `seed` deletes `Chunk` nodes but not the vector index, so the index survives re-seeding.
