import { motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { getToolMeta } from "@/config/tools"
import { formatNumber } from "@/lib/format"
import { EASE_OUT_EXPO, fadeUp } from "@/lib/motion"
import type { byTool } from "../stats"

export function ToolCalls({
  tools,
}: Readonly<{ tools: ReturnType<typeof byTool> }>) {
  const topTool = tools[0]?.calls ?? 0

  return (
    <motion.section variants={fadeUp} className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">Tool calls</h2>
      {tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tools called in this range.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {tools.map((tool) => {
            const meta = getToolMeta(tool.name)
            const Icon = meta.icon
            return (
              <li key={tool.name} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Icon
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                    {meta.label}
                  </span>
                  <Badge variant="secondary" className="tabular-nums">
                    {formatNumber(tool.calls)}
                  </Badge>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full origin-left rounded-full bg-primary"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: tool.calls / topTool }}
                    transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </motion.section>
  )
}
