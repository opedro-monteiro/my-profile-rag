import * as React from "react"
import { motion } from "motion/react"
import { IconRefresh } from "@tabler/icons-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useChatStore } from "@/features/chat/chat-store"
import { fadeUp, stagger } from "@/lib/motion"
import { RangeToggle } from "./components/range-toggle"
import { UsageContent } from "./components/usage-content"
import type { Range } from "./stats"
import { useUsage } from "./use-usage"

export function DashboardView() {
  const { streamingId } = useChatStore()
  const [range, setRange] = React.useState<Range>("7d")
  const { state, reload } = useUsage(range, streamingId)

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title="Dashboard">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Reload usage"
              onClick={reload}
            >
              <IconRefresh />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reload from the API</TooltipContent>
        </Tooltip>
      </PageHeader>

      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        animate="visible"
        className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <motion.div variants={fadeUp} className="flex flex-col gap-2">
            <h1 className="font-display text-5xl leading-none tracking-tight">
              Usage
            </h1>
            <p className="text-muted-foreground">
              Tokens and replies recorded by the API, across every visitor.
            </p>
          </motion.div>
          <motion.div variants={fadeUp}>
            <RangeToggle value={range} onChange={setRange} />
          </motion.div>
        </div>

        <UsageContent state={state} range={range} onRetry={reload} />
      </motion.div>
    </div>
  )
}
