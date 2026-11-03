import * as React from "react"
import { motion } from "motion/react"
import {
  IconAlertCircle,
  IconCheck,
  IconCopy,
  IconRefresh,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { modelLabel } from "@/config/models"
import { formatDuration, formatNumber, formatTokens } from "@/lib/format"
import { transitions } from "@/lib/motion"
import { AgentSteps } from "./agent-steps"
import { MarkdownContent } from "./markdown"
import type { AssistantMessage, ChatMessage } from "./types"

function IconAction({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function CopyAction({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <IconAction
      label={copied ? "Copied" : "Copy"}
      onClick={() =>
        navigator.clipboard
          .writeText(value)
          .then(() => setCopied(true))
          .catch(() => {})
      }
    >
      {copied ? <IconCheck /> : <IconCopy />}
    </IconAction>
  )
}

function AssistantFooter({
  message,
  canRetry,
  onRetry,
  pinned,
}: {
  message: AssistantMessage
  canRetry: boolean
  onRetry: () => void
  pinned: boolean
}) {
  const duration =
    message.finishedAt !== undefined
      ? formatDuration(message.finishedAt - message.startedAt)
      : null

  return (
    <MessageFooter
      className={cn(
        "gap-1 px-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:opacity-100",
        !pinned && "opacity-0"
      )}
    >
      {message.content ? <CopyAction value={message.content} /> : null}
      <IconAction label="Regenerate" onClick={onRetry} disabled={!canRetry}>
        <IconRefresh />
      </IconAction>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-1 cursor-default font-mono text-[11px] tabular-nums">
            {modelLabel(message.model.id)}
            {message.usage
              ? ` · ${formatTokens(message.usage.totalTokens)} tokens`
              : ""}
            {duration ? ` · ${duration}` : ""}
          </span>
        </TooltipTrigger>
        <TooltipContent className="font-mono text-[11px] tabular-nums">
          {message.usage ? (
            <>
              <span className="block">
                in {formatNumber(message.usage.inputTokens)} · out{" "}
                {formatNumber(message.usage.outputTokens)}
              </span>
              <span className="block opacity-70">{message.model.id}</span>
            </>
          ) : (
            message.model.id
          )}
        </TooltipContent>
      </Tooltip>
    </MessageFooter>
  )
}

function FailureNotice({
  message,
  canRetry,
  onRetry,
}: {
  message: AssistantMessage
  canRetry: boolean
  onRetry: () => void
}) {
  return (
    <Alert variant="destructive" className="max-w-xl">
      <IconAlertCircle />
      <AlertTitle>The reply failed</AlertTitle>
      <AlertDescription>{message.error}</AlertDescription>
      <AlertAction>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={!canRetry}
        >
          <IconRefresh data-icon="inline-start" />
          Retry
        </Button>
      </AlertAction>
    </Alert>
  )
}

interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
  canRetry: boolean
  onRetry: (id: string) => void
}

export const MessageItem = React.memo(function MessageItem({
  message,
  isLast,
  canRetry,
  onRetry,
}: MessageItemProps) {
  if (message.role === "user")
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.enter}
      >
        <Message align="end">
          <MessageContent>
            <Bubble align="end" variant="secondary">
              <BubbleContent className="whitespace-pre-wrap">
                {message.content}
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      </motion.div>
    )

  const streaming = message.status === "streaming"
  const runningStep = message.steps.some((step) => !step.endedAt)
  const pending = streaming && !message.content && !runningStep
  const retry = () => onRetry(message.id)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transitions.enter}
    >
      <Message>
        <MessageContent className="gap-4">
          <AgentSteps steps={message.steps} pending={pending} />
          {message.content ? (
            <div className="text-[15px] text-foreground">
              <MarkdownContent>{message.content}</MarkdownContent>
              {streaming ? (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-full bg-primary"
                />
              ) : null}
            </div>
          ) : null}
          {message.status === "stopped" ? (
            <p className="text-sm text-muted-foreground italic">Stopped.</p>
          ) : null}
          {message.status === "error" ? (
            <FailureNotice
              message={message}
              canRetry={canRetry}
              onRetry={retry}
            />
          ) : null}
          {streaming || message.status === "error" ? null : (
            <AssistantFooter
              message={message}
              canRetry={canRetry}
              onRetry={retry}
              pinned={isLast}
            />
          )}
        </MessageContent>
      </Message>
    </motion.div>
  )
})
