import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { IconAlertTriangle, IconBulb } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { getToolMeta } from "@/config/tools"
import { formatDuration } from "@/lib/format"
import { transitions } from "@/lib/motion"
import type { ReasoningStep, Step, ToolStep } from "./types"

const PASSAGE_PATTERN = /^\[Trecho \d+\]/gm

function countPassages(output: string) {
  return output.match(PASSAGE_PATTERN)?.length ?? 0
}

function describeInput(input: ToolStep["input"]) {
  if (!input) return null

  const values = Object.values(input).filter((value) => value !== undefined)
  if (values.length !== 1 || typeof values[0] !== "string") return null

  return `“${values[0]}”`
}

function ReasoningRow({ step }: { step: ReasoningStep }) {
  const running = !step.endedAt
  const [open, setOpen] = React.useState<boolean | undefined>(undefined)

  const line = (
    <TraceLine status={running ? "running" : undefined}>
      <TraceIcon>
        <IconBulb />
      </TraceIcon>
      <TraceTitle>
        {running
          ? "Thinking"
          : `Thought for ${formatDuration(step.endedAt! - step.startedAt)}`}
      </TraceTitle>
    </TraceLine>
  )

  if (!step.text.trim()) return line

  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="max-h-72 overflow-y-auto text-[13px] whitespace-pre-wrap">
        {step.text.trim()}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

function ToolRow({ step }: { step: ToolStep }) {
  const meta = getToolMeta(step.name)
  const Icon = step.status === "error" ? IconAlertTriangle : meta.icon
  const query = describeInput(step.input)
  const passages = step.output ? countPassages(step.output) : 0
  const title =
    step.status === "running"
      ? meta.running
      : step.status === "error"
        ? meta.failed
        : meta.done
  const status =
    step.status === "running"
      ? "running"
      : step.status === "error"
        ? "error"
        : undefined

  const line = (
    <TraceLine status={status}>
      <Tooltip>
        <TooltipTrigger asChild>
          <TraceIcon className="pointer-events-auto">
            <Icon />
          </TraceIcon>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64">
          <span className="font-medium">{meta.label}</span>
          <span className="block opacity-80">{meta.hint}</span>
        </TooltipContent>
      </Tooltip>
      <TraceTitle>
        {title}
        {query ? <span className="text-foreground/80"> {query}</span> : null}
      </TraceTitle>
      {step.endedAt ? (
        <TraceDescription>
          {formatDuration(step.endedAt - step.startedAt)}
        </TraceDescription>
      ) : null}
    </TraceLine>
  )

  if (!step.output && !step.input) return line

  return (
    <TraceCollapsible defaultOpen={step.status === "error"}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="flex flex-col gap-3">
        {step.input ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {Object.entries(step.input).map(([key, value]) => (
              <React.Fragment key={key}>
                <dt className="font-mono text-muted-foreground">{key}</dt>
                <dd className="text-foreground">
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        ) : null}
        {step.output ? (
          <CodeBlock
            size="sm"
            variant={step.status === "error" ? "destructive" : "default"}
          >
            <CodeBlockHeader>
              <CodeBlockTitle>Result</CodeBlockTitle>
              {passages > 0 ? (
                <Badge variant="secondary">
                  {passages} {passages === 1 ? "passage" : "passages"}
                </Badge>
              ) : null}
              <CodeBlockActions>
                <CodeBlockCopyButton value={step.output} />
              </CodeBlockActions>
            </CodeBlockHeader>
            <CodeBlockContent wrap className="max-h-64 font-sans">
              {step.output}
            </CodeBlockContent>
          </CodeBlock>
        ) : null}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

interface AgentStepsProps {
  steps: Step[]
  pending: boolean
}

export function AgentSteps({ steps, pending }: AgentStepsProps) {
  if (steps.length === 0 && !pending) return null

  return (
    <Trace>
      <AnimatePresence initial={false}>
        {steps.map((step) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitions.quick}
          >
            {step.kind === "reasoning" ? (
              <ReasoningRow step={step} />
            ) : (
              <ToolRow step={step} />
            )}
          </motion.div>
        ))}
        {pending ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.quick}
          >
            <TraceLine status="running">
              <TraceTitle>
                {steps.length === 0 ? "Thinking" : "Writing the answer"}
              </TraceTitle>
            </TraceLine>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Trace>
  )
}
