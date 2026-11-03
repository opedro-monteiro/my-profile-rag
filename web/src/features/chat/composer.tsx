import * as React from "react"
import { motion } from "motion/react"
import {
  IconArrowUp,
  IconBrain,
  IconPlayerStopFilled,
} from "@tabler/icons-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { transitions } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { useChatStore } from "./chat-store"
import { ModelSelector } from "./model-selector"

const MAX_LENGTH = 4000

export function Composer({ autoFocus }: { autoFocus?: boolean }) {
  const { send, stop, streamingId, model, setModel, think, setThink } =
    useChatStore()
  const [text, setText] = React.useState("")
  const formRef = React.useRef<HTMLFormElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const busy = streamingId !== null
  const canSend = text.trim().length > 0 && !busy

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend) return

    send(text)
    setText("")
    textareaRef.current?.focus()
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="w-full">
      <InputGroup className="rounded-xl bg-card shadow-[0_1px_0_0_var(--border),0_12px_32px_-16px_color-mix(in_oklch,var(--foreground),transparent_85%)]">
        <InputGroupTextarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              formRef.current?.requestSubmit()
            }
          }}
          placeholder="Ask about experience, projects, skills…"
          aria-label="Message"
          maxLength={MAX_LENGTH}
          autoFocus={autoFocus}
          className="max-h-48 min-h-14 px-4 pt-3.5 text-[15px]"
        />
        <InputGroupAddon align="block-end" className="gap-1">
          <ModelSelector
            model={model}
            onModelChange={setModel}
            disabled={busy}
          />
          {model.supportsThinking ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  size="sm"
                  variant="ghost"
                  aria-pressed={think}
                  onClick={() => setThink(!think)}
                  disabled={busy}
                  className={cn(
                    think &&
                      "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  )}
                >
                  <IconBrain data-icon="inline-start" />
                  Think
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>
                {think
                  ? "Thinking on: slower, shows its reasoning"
                  : "Let the model reason before answering"}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            <Kbd>⏎</Kbd> send · <Kbd>⇧⏎</Kbd> new line
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              {busy ? (
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  className="ml-2 rounded-full"
                  aria-label="Stop"
                  onClick={stop}
                >
                  <IconPlayerStopFilled />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  className="ml-2 rounded-full"
                  aria-label="Send"
                  disabled={!canSend}
                >
                  <motion.span
                    key={canSend ? "ready" : "idle"}
                    initial={{ y: 4, opacity: 0.4 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={transitions.quick}
                    className="flex"
                  >
                    <IconArrowUp />
                  </motion.span>
                </InputGroupButton>
              )}
            </TooltipTrigger>
            <TooltipContent>{busy ? "Stop generating" : "Send"}</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
