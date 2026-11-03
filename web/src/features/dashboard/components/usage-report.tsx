import * as React from "react"
import type { UsageRecord } from "@/lib/api"
import { byModel, byTool, summarize, tokensByDay, type Range } from "../stats"
import { ModelsTable } from "./models-table"
import { TokensChart } from "./tokens-chart"
import { ToolCalls } from "./tool-calls"
import { UsageFigures } from "./usage-figures"

export function UsageReport({
  records,
  range,
}: Readonly<{ records: UsageRecord[]; range: Range }>) {
  const summary = React.useMemo(() => summarize(records), [records])
  const days = React.useMemo(
    () => tokensByDay(records, range),
    [records, range]
  )
  const models = React.useMemo(() => byModel(records), [records])
  const tools = React.useMemo(() => byTool(records), [records])

  return (
    <>
      <UsageFigures summary={summary} />
      <TokensChart days={days} />
      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <ModelsTable models={models} />
        <ToolCalls tools={tools} />
      </div>
    </>
  )
}
