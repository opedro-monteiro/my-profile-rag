import { motion } from "motion/react"
import { IconArrowUpRight } from "@tabler/icons-react"
import { PageHeader } from "@/components/layout/page-header"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { fadeUp, stagger } from "@/lib/motion"
import { useChatStore } from "./chat-store"
import { Composer } from "./composer"
import { ContextMeter } from "./context-meter"
import { MessageItem } from "./message-item"
import type { Conversation } from "./types"

const SUGGESTIONS = [
  { prompt: "Who is Pedro Monteiro?", hint: "A quick introduction" },
  {
    prompt: "What is his professional experience?",
    hint: "Roles and companies",
  },
  { prompt: "Which technologies does he work with?", hint: "Stack and tools" },
  { prompt: "What has he built recently?", hint: "Projects and results" },
]

function EmptyChat() {
  const { send } = useChatStore()

  return (
    <div className="flex flex-1 flex-col justify-center overflow-y-auto px-4 py-10">
      <motion.div
        variants={stagger(0.07)}
        initial="hidden"
        animate="visible"
        className="mx-auto flex w-full max-w-2xl flex-col gap-10"
      >
        <motion.div variants={fadeUp} className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
            Profile assistant
          </span>
          <h1 className="font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.02] tracking-tight text-balance">
            What would you like to know about{" "}
            <em className="text-primary">Pedro</em>?
          </h1>
          <p className="max-w-md text-muted-foreground">
            Answers come from his profile, retrieved from a Neo4j vector index.
            Open any step to see what the agent searched and found.
          </p>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Composer autoFocus />
        </motion.div>

        <motion.ul
          variants={stagger(0.05)}
          className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2"
        >
          {SUGGESTIONS.map((suggestion) => (
            <motion.li key={suggestion.prompt} variants={fadeUp}>
              <button
                type="button"
                onClick={() => send(suggestion.prompt)}
                className="group flex h-full w-full items-start justify-between gap-3 bg-background px-4 py-3.5 text-left transition-colors outline-none hover:bg-accent focus-visible:bg-accent"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {suggestion.prompt}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {suggestion.hint}
                  </span>
                </span>
                <IconArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </button>
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>
    </div>
  )
}

function Thread({ conversation }: { conversation: Conversation }) {
  const { retry, streamingId } = useChatStore()
  const busy = streamingId !== null
  const lastId = conversation.messages.at(-1)?.id

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-10 px-4 pt-8 pb-16 sm:px-6">
            {conversation.messages.map((message) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor={message.role === "user"}
              >
                <MessageItem
                  message={message}
                  isLast={message.id === lastId}
                  canRetry={!busy}
                  onRetry={retry}
                />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

export function ChatView() {
  const { active, model } = useChatStore()
  const hasMessages = Boolean(active && active.messages.length > 0)

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <PageHeader title={active?.title ?? "New chat"}>
        {active ? <ContextMeter conversation={active} model={model} /> : null}
      </PageHeader>

      {hasMessages && active ? (
        <>
          <Thread key={active.id} conversation={active} />
          <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
            <Composer />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Answers are generated from the profile and can still be wrong.
            </p>
          </div>
        </>
      ) : (
        <EmptyChat />
      )}
    </div>
  )
}
