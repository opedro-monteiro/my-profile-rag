import { motion } from "motion/react"
import { formatDuration, formatNumber, formatTokens } from "@/lib/format"
import { stagger } from "@/lib/motion"
import type { summarize } from "../stats"
import { Figure } from "./figure"

export function UsageFigures({
  summary,
}: Readonly<{ summary: ReturnType<typeof summarize> }>) {
  return (
    <motion.dl
      variants={stagger(0.05)}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]"
    >
      <Figure
        emphasis
        label="Total tokens"
        hint="Input plus output, across every reply"
        value={summary.totalTokens}
        format={formatTokens}
      />
      <Figure
        label="Input"
        hint="Prompt, history and retrieved passages sent to the model"
        value={summary.inputTokens}
        format={formatTokens}
      />
      <Figure
        label="Output"
        hint="Tokens the model generated"
        value={summary.outputTokens}
        format={formatTokens}
      />
      <Figure
        label="Replies"
        hint={`${summary.failures} failed`}
        value={summary.replies}
        format={formatNumber}
      />
      <Figure
        label="Avg. latency"
        hint="From sending the message to the end of the reply"
        value={summary.averageMs}
        format={formatDuration}
      />
    </motion.dl>
  )
}
