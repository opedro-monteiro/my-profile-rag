import type { ModelProvider } from "@/config/models"

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ReasoningStep {
  kind: "reasoning"
  id: string
  text: string
  startedAt: number
  endedAt?: number
}

export interface ToolStep {
  kind: "tool"
  id: string
  name: string
  input?: Record<string, unknown>
  output?: string
  status: "running" | "success" | "error"
  startedAt: number
  endedAt?: number
}

export type Step = ReasoningStep | ToolStep

export interface UserMessage {
  id: string
  role: "user"
  content: string
  createdAt: number
}

export type AssistantStatus = "streaming" | "done" | "error" | "stopped"

export interface AssistantMessage {
  id: string
  role: "assistant"
  content: string
  steps: Step[]
  status: AssistantStatus
  error?: string
  usage?: TokenUsage
  /** Tokens of the last model call, which is what fills the context window. */
  contextTokens?: number
  model: { id: string; provider: ModelProvider }
  startedAt: number
  finishedAt?: number
}

export type ChatMessage = UserMessage | AssistantMessage

export interface Conversation {
  id: string
  title: string
  threadId?: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}
