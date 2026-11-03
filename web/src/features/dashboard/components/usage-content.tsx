import type { Range } from "../stats"
import type { useUsage } from "../use-usage"
import { DashboardSkeleton } from "./dashboard-skeleton"
import { UsageEmpty } from "./usage-empty"
import { UsageError } from "./usage-error"
import { UsageReport } from "./usage-report"

export function UsageContent({
  state,
  range,
  onRetry,
}: Readonly<{
  state: ReturnType<typeof useUsage>["state"]
  range: Range
  onRetry: () => void
}>) {
  if (state.status === "error")
    return <UsageError error={state.error} onRetry={onRetry} />

  if (!state.records) return <DashboardSkeleton />

  if (state.records.length === 0) return <UsageEmpty />

  return <UsageReport records={state.records} range={range} />
}
