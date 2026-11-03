import { motion } from "motion/react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { modelLabel } from "@/config/models"
import { formatDuration, formatNumber } from "@/lib/format"
import { fadeUp } from "@/lib/motion"
import type { byModel } from "../stats"

export function ModelsTable({
  models,
}: Readonly<{ models: ReturnType<typeof byModel> }>) {
  return (
    <motion.section variants={fadeUp} className="flex min-w-0 flex-col gap-4">
      <h2 className="text-sm font-medium">By model</h2>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Replies</TableHead>
              <TableHead className="text-right">Input</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead className="text-right">Avg. latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((row) => (
              <TableRow key={row.modelId}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {modelLabel(row.modelId)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.provider}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.replies}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {formatNumber(row.inputTokens)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {formatNumber(row.outputTokens)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {formatDuration(row.durationMs / row.replies)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.section>
  )
}
