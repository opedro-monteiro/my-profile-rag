import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Progress } from "@/components/ui/progress"
import type { ModelOption } from "@/config/models"
import { formatTokens } from "@/lib/format"
import type { Conversation } from "./types"

function lastReply(conversation: Conversation) {
  for (let index = conversation.messages.length - 1; index >= 0; index--) {
    const message = conversation.messages[index]
    if (message.role === "assistant" && message.usage) return message
  }
  return null
}

function sessionTotals(conversation: Conversation) {
  let input = 0
  let output = 0

  for (const message of conversation.messages)
    if (message.role === "assistant" && message.usage) {
      input += message.usage.inputTokens
      output += message.usage.outputTokens
    }

  return { input, output }
}

export function ContextMeter({
  conversation,
  model,
}: {
  conversation: Conversation
  model: ModelOption
}) {
  const reply = lastReply(conversation)
  if (!reply?.usage) return null

  const { usage } = reply
  const used = reply.contextTokens ?? usage.inputTokens + usage.outputTokens
  const percent = Math.min(100, Math.round((used / model.contextWindow) * 100))
  const totals = sessionTotals(conversation)
  const rows = [
    { label: "Last reply in", value: usage.inputTokens },
    { label: "Last reply out", value: usage.outputTokens },
    { label: "Conversation in", value: totals.input },
    { label: "Conversation out", value: totals.output },
  ]

  return (
    <HoverCard openDelay={10} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 font-mono text-xs tabular-nums"
        >
          <svg viewBox="0 0 16 16" className="size-3.5 -rotate-90" aria-hidden>
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              strokeWidth="2.5"
              className="stroke-border"
            />
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${Math.max(percent, 2)} 100`}
              className="stroke-primary transition-[stroke-dasharray] duration-500"
            />
          </svg>
          {percent}%
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="flex w-64 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">Context window</span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatTokens(used)} / {formatTokens(model.contextWindow)}
          </span>
        </div>
        <Progress value={percent} aria-label="Context used" />
        <dl className="flex flex-col gap-1 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-mono text-xs tabular-nums">
                {formatTokens(row.value)}
              </dd>
            </div>
          ))}
        </dl>
      </HoverCardContent>
    </HoverCard>
  )
}
