import * as React from "react"
import { findModel, type ModelOption } from "@/config/models"
import { postChatStream } from "@/lib/api"
import { readSse } from "@/lib/sse"
import { readJson, writeJson } from "@/lib/storage"
import { applyEvent, settleSteps } from "./apply-event"
import type { AssistantMessage, ChatMessage, Conversation } from "./types"

const CONVERSATIONS_KEY = "profile-rag:conversations"
const USAGE_KEY = "profile-rag:usage"
const PREFERENCES_KEY = "profile-rag:preferences"
const TITLE_LENGTH = 48
const PERSIST_DELAY_MS = 400

export interface UsageRecord {
  at: number
  modelId: string
  provider: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  durationMs: number
  tools: string[]
  status: AssistantMessage["status"]
}

interface Preferences {
  modelId: string
  think: boolean
}

interface ChatStore {
  conversations: Conversation[]
  activeId: string | null
  active: Conversation | null
  streamingId: string | null
  usage: UsageRecord[]
  model: ModelOption
  think: boolean
  setModel: (id: string) => void
  setThink: (think: boolean) => void
  select: (id: string | null) => void
  remove: (id: string) => void
  send: (text: string) => void
  retry: (assistantId: string) => void
  stop: () => void
  clearUsage: () => void
}

const ChatStoreContext = React.createContext<ChatStore | null>(null)

function makeTitle(text: string) {
  const line = text.trim().split("\n")[0]
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH)}…` : line
}

function toUsageRecord(message: AssistantMessage): UsageRecord {
  return {
    at: message.startedAt,
    modelId: message.model.id,
    provider: message.model.provider,
    inputTokens: message.usage?.inputTokens ?? 0,
    outputTokens: message.usage?.outputTokens ?? 0,
    totalTokens: message.usage?.totalTokens ?? 0,
    durationMs: (message.finishedAt ?? message.startedAt) - message.startedAt,
    tools: message.steps.flatMap((step) =>
      step.kind === "tool" ? [step.name] : []
    ),
    status: message.status,
  }
}

/** Streams left mid-way by a reload can never finish, so they are closed. */
function restoreConversations(): Conversation[] {
  return readJson<Conversation[]>(CONVERSATIONS_KEY, []).map(
    (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.role === "assistant" && message.status === "streaming"
          ? {
              ...settleSteps(message, message.startedAt, true),
              status: "stopped",
            }
          : message
      ),
    })
  )
}

export function ChatStoreProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = React.useState(restoreConversations)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [streamingId, setStreamingId] = React.useState<string | null>(null)
  const [usage, setUsage] = React.useState(() =>
    readJson<UsageRecord[]>(USAGE_KEY, [])
  )
  const [preferences, setPreferences] = React.useState(() =>
    readJson<Preferences>(PREFERENCES_KEY, { modelId: "", think: false })
  )

  const abortRef = React.useRef<AbortController | null>(null)
  const conversationsRef = React.useRef(conversations)

  React.useLayoutEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const model = findModel(preferences.modelId)
  const think = Boolean(preferences.think && model.supportsThinking)

  React.useEffect(() => {
    const timeout = setTimeout(
      () => writeJson(CONVERSATIONS_KEY, conversations),
      PERSIST_DELAY_MS
    )
    return () => clearTimeout(timeout)
  }, [conversations])

  React.useEffect(() => writeJson(USAGE_KEY, usage), [usage])
  React.useEffect(() => writeJson(PREFERENCES_KEY, preferences), [preferences])
  React.useEffect(() => () => abortRef.current?.abort(), [])

  const patchConversation = React.useCallback(
    (id: string, update: (conversation: Conversation) => Conversation) =>
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id ? update(conversation) : conversation
        )
      ),
    []
  )

  const patchMessage = React.useCallback(
    (
      conversationId: string,
      messageId: string,
      update: (message: AssistantMessage) => AssistantMessage
    ) =>
      patchConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId && message.role === "assistant"
            ? update(message)
            : message
        ),
      })),
    [patchConversation]
  )

  const stream = React.useCallback(
    async (conversationId: string, text: string, history: ChatMessage[]) => {
      const conversation = conversationsRef.current.find(
        (item) => item.id === conversationId
      )
      const assistant: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        steps: [],
        status: "streaming",
        model: { id: model.id, provider: model.provider },
        startedAt: Date.now(),
      }
      const patch = (update: (message: AssistantMessage) => AssistantMessage) =>
        patchMessage(conversationId, assistant.id, update)

      patchConversation(conversationId, (current) => ({
        ...current,
        messages: [...history, assistant],
        updatedAt: Date.now(),
      }))

      const controller = new AbortController()
      abortRef.current = controller
      setStreamingId(conversationId)
      let final = assistant

      try {
        const body = await postChatStream({
          message: text,
          threadId: conversation?.threadId,
          model,
          think,
          signal: controller.signal,
        })

        for await (const { event, data } of readSse(body)) {
          const payload = JSON.parse(data) as Record<string, unknown>

          if (event === "start") {
            patchConversation(conversationId, (current) => ({
              ...current,
              threadId: String(payload.threadId),
            }))
            continue
          }

          final = applyEvent(final, event, payload)
          const snapshot = final
          patch(() => snapshot)
        }

        final = { ...settleSteps(final, Date.now(), false), status: "done" }
      } catch (error) {
        const now = Date.now()

        if (controller.signal.aborted)
          final = { ...settleSteps(final, now, true), status: "stopped" }
        else {
          const reason =
            error instanceof TypeError
              ? "Could not reach the API. Is it running?"
              : error instanceof Error
                ? error.message
                : "Something went wrong."
          final = {
            ...settleSteps(final, now, true),
            status: "error",
            error: reason,
          }
        }
      } finally {
        final = { ...final, finishedAt: Date.now() }
        const settled = final
        patch(() => settled)
        setUsage((current) => [...current, toUsageRecord(settled)])
        if (abortRef.current === controller) abortRef.current = null
        setStreamingId(null)
      }
    },
    [model, think, patchConversation, patchMessage]
  )

  const send = React.useCallback(
    (text: string) => {
      const message = text.trim()
      if (!message || abortRef.current) return

      const now = Date.now()
      const user: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        createdAt: now,
      }
      let conversation = conversationsRef.current.find(
        (item) => item.id === activeId
      )

      if (!conversation) {
        conversation = {
          id: crypto.randomUUID(),
          title: makeTitle(message),
          messages: [],
          createdAt: now,
          updatedAt: now,
        }
        const created = conversation
        setConversations((current) => [created, ...current])
        conversationsRef.current = [created, ...conversationsRef.current]
        setActiveId(created.id)
      }

      void stream(conversation.id, message, [...conversation.messages, user])
    },
    [activeId, stream]
  )

  const retry = React.useCallback(
    (assistantId: string) => {
      if (abortRef.current || !activeId) return

      const conversation = conversationsRef.current.find(
        (item) => item.id === activeId
      )
      const index =
        conversation?.messages.findIndex((item) => item.id === assistantId) ??
        -1
      const previous = conversation?.messages[index - 1]
      if (!conversation || previous?.role !== "user") return

      void stream(
        conversation.id,
        previous.content,
        conversation.messages.slice(0, index)
      )
    },
    [activeId, stream]
  )

  const stop = React.useCallback(() => abortRef.current?.abort(), [])

  const select = React.useCallback((id: string | null) => setActiveId(id), [])

  const remove = React.useCallback(
    (id: string) => {
      if (streamingId === id) abortRef.current?.abort()
      setConversations((current) => current.filter((item) => item.id !== id))
      setActiveId((current) => (current === id ? null : current))
    },
    [streamingId]
  )

  const setModel = React.useCallback(
    (modelId: string) => setPreferences((current) => ({ ...current, modelId })),
    []
  )

  const setThink = React.useCallback(
    (value: boolean) =>
      setPreferences((current) => ({ ...current, think: value })),
    []
  )

  const clearUsage = React.useCallback(() => setUsage([]), [])

  const active = conversations.find((item) => item.id === activeId) ?? null

  const value = React.useMemo<ChatStore>(
    () => ({
      conversations,
      activeId,
      active,
      streamingId,
      usage,
      model,
      think,
      setModel,
      setThink,
      select,
      remove,
      send,
      retry,
      stop,
      clearUsage,
    }),
    [
      conversations,
      activeId,
      active,
      streamingId,
      usage,
      model,
      think,
      setModel,
      setThink,
      select,
      remove,
      send,
      retry,
      stop,
      clearUsage,
    ]
  )

  return (
    <ChatStoreContext.Provider value={value}>
      {children}
    </ChatStoreContext.Provider>
  )
}

export function useChatStore() {
  const context = React.useContext(ChatStoreContext)
  if (!context)
    throw new Error("useChatStore must be used within ChatStoreProvider")

  return context
}
